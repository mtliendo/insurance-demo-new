import { getCurrentBoard } from '@/lib/board'
import { bindingMessageForClaim } from '@/lib/binding-message'
import { pollCiba, startCiba } from '@/lib/ciba'
import {
  countCibaApproved,
  hasCibaStarted,
  insertCibaAuthorization,
  listCibaForClaim,
  updateCibaStatus,
} from '@/lib/ciba-store'
import {
  approveClaim,
  attachCalendarEvent,
  getClaim,
  setCibaBlockReason,
} from '@/lib/claims'
import { createEvent } from '@/lib/google-calendar'
import { getGoogleAccessToken, isGoogleConnected } from '@/lib/google'
import { CIBA_REQUIRED_APPROVALS } from '@/lib/types'
import type { Claim } from '@/lib/types'

export type CibaStartResult =
  | { ok: true; started: number }
  | { ok: false; reason: 'no_google' | 'no_board' | 'already_started' }

/**
 * When a claim flips to awaiting_approval, email the seated 6 — not the
 * whole room. Refuses to send if the host has not connected Google
 * (hollow approval otherwise) or if no board has been picked.
 */
export async function startCibaForSubmittedClaim(claimId: string): Promise<CibaStartResult> {
  if (await hasCibaStarted(claimId)) {
    return { ok: false, reason: 'already_started' }
  }

  if (!(await isGoogleConnected())) {
    await setCibaBlockReason(claimId, 'no_google')
    return { ok: false, reason: 'no_google' }
  }

  const board = await getCurrentBoard()
  if (board.length === 0) {
    await setCibaBlockReason(claimId, 'no_board')
    return { ok: false, reason: 'no_board' }
  }

  await setCibaBlockReason(claimId, null)
  const bindingMessage = bindingMessageForClaim(claimId)
  let started = 0

  for (const member of board) {
    try {
      const result = await startCiba(member.sub, bindingMessage)
      const expiresAt = new Date(Date.now() + result.expiresIn * 1000)
      await insertCibaAuthorization({
        claimId,
        authReqId: result.authReqId,
        sub: member.sub,
        email: member.email,
        name: member.name,
        status: 'pending',
        bindingMessage: result.bindingMessage,
        intervalSec: result.interval,
        expiresAt,
      })
      started += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'bc-authorize failed'
      await insertCibaAuthorization({
        claimId,
        authReqId: `error-${claimId}-${member.sub}`,
        sub: member.sub,
        email: member.email,
        name: member.name,
        status: 'error',
        bindingMessage,
        intervalSec: 5,
        expiresAt: null,
        error: message,
      })
    }
  }

  return { ok: true, started }
}

/**
 * Poll every pending auth_req_id we minted. Three yeses release the claim,
 * then write one event on the host's Google Calendar via Token Vault.
 */
export async function pollCibaForClaim(claimId: string): Promise<Claim | null> {
  const pending = (await listCibaForClaim(claimId)).filter((row) => row.status === 'pending')

  for (const row of pending) {
    const result = await pollCiba(row.auth_req_id)
    if (result.status === 'pending') {
      if (result.interval) {
        await updateCibaStatus(row.auth_req_id, 'pending', { intervalSec: result.interval })
      }
      continue
    }
    await updateCibaStatus(row.auth_req_id, result.status, {
      error: 'error' in result ? result.error : null,
    })
  }

  const approved = await countCibaApproved(claimId)
  if (approved >= CIBA_REQUIRED_APPROVALS) {
    await approveClaim(claimId)
    await writeHostCalendarEvent(claimId)
  }

  return getClaim(claimId)
}

async function writeHostCalendarEvent(claimId: string): Promise<void> {
  const claim = await getClaim(claimId)
  if (!claim || claim.calendarEventId) return

  const token = await getGoogleAccessToken()
  if (!token) return

  const yeses = (await listCibaForClaim(claimId))
    .filter((row) => row.status === 'approved')
    .map((row) => row.name)
    .join(', ')

  const start = new Date()
  const end = new Date(start.getTime() + 30 * 60 * 1000)

  try {
    const event = await createEvent(token, {
      summary: `Hero Shield claim approved · ${claim.policyId}`,
      description: [
        claim.incidentDescription ?? 'Superhero incident',
        claim.incidentLocation ? `Location: ${claim.incidentLocation}` : null,
        claim.damageExtent ? `Damage: ${claim.damageExtent}` : null,
        `Released by CIBA board: ${yeses}`,
        `Claim ${claim.id}`,
      ]
        .filter(Boolean)
        .join('\n'),
      location: claim.incidentLocation ?? undefined,
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      timeZone: 'America/Los_Angeles',
    })
    await attachCalendarEvent(claimId, event.id)
  } catch (error) {
    console.error('Failed to write host calendar event:', error)
  }
}
