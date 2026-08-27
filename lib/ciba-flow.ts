import { getCurrentBoard } from '@/lib/board'
import { bindingMessageForClaim } from '@/lib/binding-message'
import { pollCiba, startCiba } from '@/lib/ciba'
import { CIBA_INTERVAL_FLOOR, floorInterval, nextPollInterval } from '@/lib/ciba-interval'
import {
  claimCibaPollSlot,
  countCibaApproved,
  duePendingCiba,
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
import { auth0 } from '@/lib/auth0'
import { getBoardSettings, isFullBoard } from '@/lib/board-config'
import { canWriteHostCalendar, isDemoHost } from '@/lib/host'
import type { Claim } from '@/lib/types'

export type CibaStartResult =
  | { ok: true; started: number }
  | { ok: false; reason: 'no_google' | 'no_board' | 'already_started' | 'not_host' }

type SessionUser = { sub?: string; email?: string | null }

/**
 * When a claim flips to awaiting_approval, email the seated board — not
 * the whole room. Refuses to send if the host has not connected Google
 * (hollow approval otherwise) or if the seated board is not exactly
 * BOARD_SIZE (empty or leftover short pick).
 */
export async function startCibaForSubmittedClaim(claimId: string): Promise<CibaStartResult> {
  if (await hasCibaStarted(claimId)) {
    return { ok: false, reason: 'already_started' }
  }

  const session = await auth0.getSession()
  if (!session || !isDemoHost(session.user)) {
    return { ok: false, reason: 'not_host' }
  }

  if (!(await isGoogleConnected())) {
    await setCibaBlockReason(claimId, 'no_google')
    return { ok: false, reason: 'no_google' }
  }

  const { boardSize } = await getBoardSettings()
  const board = await getCurrentBoard()
  if (!isFullBoard(board.length, boardSize)) {
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
        intervalSec: floorInterval(result.interval),
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
        intervalSec: CIBA_INTERVAL_FLOOR,
        expiresAt: null,
        error: message,
      })
    }
  }

  return { ok: true, started }
}

/**
 * Poll due pending auth_req_ids only. CIBA_YES_THRESHOLD yeses
 * (stage default 3) release the claim, then write one event on the
 * host's Google Calendar via Token Vault — and only if this session
 * is the configured host.
 */
export async function pollCibaForClaim(
  claimId: string,
  actor: SessionUser,
): Promise<Claim | null> {
  const pending = duePendingCiba(await listCibaForClaim(claimId))

  for (const row of pending) {
    const slot = await claimCibaPollSlot(row.auth_req_id)
    if (!slot) continue

    const result = await pollCiba(row.auth_req_id)
    if (result.status === 'pending') {
      const intervalSec = nextPollInterval(
        slot.interval_sec,
        result.interval,
        result.slowDown,
      )
      await updateCibaStatus(row.auth_req_id, 'pending', { intervalSec })
      continue
    }
    await updateCibaStatus(row.auth_req_id, result.status, {
      error: 'error' in result ? result.error : null,
    })
  }

  const approved = await countCibaApproved(claimId)
  const { yesThreshold } = await getBoardSettings()
  if (approved >= yesThreshold) {
    await approveClaim(claimId)
    if (canWriteHostCalendar(actor)) {
      await writeHostCalendarEvent(claimId)
    }
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
