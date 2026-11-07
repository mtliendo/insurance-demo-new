import { bindingMessageForCancel } from '@/lib/binding-message'
import {
  CIBA_CANCEL_EXPIRY_SECONDS,
  pollCiba,
  startCiba,
} from '@/lib/ciba'
import { CIBA_INTERVAL_FLOOR, floorInterval, nextPollInterval } from '@/lib/ciba-interval'
import {
  addMessage,
  cancelClaim,
  claimCancelCibaPollSlot,
  completeCancelCiba,
  getClaim,
  saveCancelCibaGrant,
  setCancelCibaStatus,
  updateCancelCibaInterval,
} from '@/lib/claims'
import type { Claim } from '@/lib/types'

function namedClaimMatches(claimId: string, named: string | undefined): boolean {
  if (!named?.trim()) return true
  const needle = named.replace(/[^a-f0-9-]/gi, '').toLowerCase()
  if (!needle) return true
  const id = claimId.toLowerCase()
  const compact = id.replace(/-/g, '')
  const compactNeedle = needle.replace(/-/g, '')
  return id.includes(needle) || compact.startsWith(compactNeedle) || compact.includes(compactNeedle)
}

export type CancelActor = {
  /** Auth0 `sub` from the current session — login_hint iss_sub. */
  sub: string
}

/**
 * CIBA-gated cancel for the claim in this chat. Emails the **signed-in
 * user** (`login_hint` iss_sub = session.sub, iss = https://${AUTH0_DOMAIN}/),
 * stores the auth_req_id on the claim, and returns. `/file-claim` polls
 * `GET /api/claims/[id]`, which ticks `/oauth/token` until Auth0 approves,
 * returns `access_denied`, or expires (`expired_token`). Does not touch
 * the board grant, Token Vault, or `ciba_authorizations`.
 */
export async function requestCancelClaim(
  claim: Claim,
  namedClaimId: string | undefined,
  actor: CancelActor,
): Promise<string> {
  if (!actor.sub) {
    return [
      'No signed-in Auth0 sub on this session. CIBA was NOT sent.',
      'The claim was NOT cancelled. Tell the user to log in again.',
    ].join(' ')
  }

  if (namedClaimId && !namedClaimMatches(claim.id, namedClaimId)) {
    return [
      `That id does not match this chat's claim (${claim.id}).`,
      'Do not cancel. Tell the user this conversation is only for the claim on screen.',
    ].join(' ')
  }

  const latest = (await getClaim(claim.id)) ?? claim
  if (latest.status === 'cancelled') {
    return 'This claim is already cancelled. Tell the user nothing else happened.'
  }

  if (latest.cancelCibaStatus === 'pending') {
    return [
      'CIBA email is already pending for this claim.',
      'Tell the user to check their email (binding message starts with Cancel-claim-#).',
      'Do not say the claim is cancelled yet. Do not say it was denied.',
    ].join(' ')
  }

  const bindingMessage = bindingMessageForCancel(latest.id)

  await setCancelCibaStatus(latest.id, 'pending')

  let started: Awaited<ReturnType<typeof startCiba>>
  try {
    started = await startCiba(actor.sub, bindingMessage, {
      requestedExpirySeconds: CIBA_CANCEL_EXPIRY_SECONDS,
    })
  } catch (error) {
    await setCancelCibaStatus(latest.id, 'denied')
    const message = error instanceof Error ? error.message : 'bc-authorize failed'
    return [
      `Could not start CIBA (${message}). The claim was NOT cancelled.`,
      'Tell the user we could not send the approval email.',
      'They need a verified email, and the Auth0 app needs the CIBA grant plus the email channel.',
      'Do not say the demo is broken.',
    ].join(' ')
  }

  await saveCancelCibaGrant(latest.id, {
    authReqId: started.authReqId,
    intervalSec: floorInterval(started.interval ?? CIBA_INTERVAL_FLOOR),
    expiresAt: new Date(Date.now() + started.expiresIn * 1000),
  })

  return [
    `CIBA email sent (binding message ${bindingMessage}, requested_expiry=${CIBA_CANCEL_EXPIRY_SECONDS}).`,
    'Status is pending. Tell the user to check their email and Accept to cancel.',
    'Do not say the claim is cancelled yet. Do not say it was denied or timed out.',
    'The manifest stays Pending until they Accept, Decline, or Auth0 expires the request (~5 minutes).',
  ].join(' ')
}

/**
 * One Auth0 `/oauth/token` tick for a pending cancel CIBA. Honors the
 * stored interval (floor 5s). Terminal only on approved, access_denied,
 * expired_token, or a hard poll error — never an app-side wait timeout.
 */
export async function pollCancelCibaForClaim(claimId: string): Promise<void> {
  const slot = await claimCancelCibaPollSlot(claimId)
  if (!slot) return

  const result = await pollCiba(slot.authReqId)

  if (result.status === 'pending') {
    await updateCancelCibaInterval(
      claimId,
      nextPollInterval(slot.intervalSec, result.interval, result.slowDown),
    )
    return
  }

  if (result.status === 'approved') {
    const won = await completeCancelCiba(claimId, 'approved')
    if (!won) return
    await cancelClaim(claimId)
    await addMessage(
      claimId,
      'assistant',
      'Your cancellation was approved. This claim is now cancelled.',
    )
    return
  }

  const won = await completeCancelCiba(claimId, 'denied')
  if (!won) return

  const expired = result.status === 'denied' && result.reason === 'expired_token'
  const denied = result.status === 'denied' && result.reason === 'access_denied'
  const content = expired
    ? 'The cancellation request timed out. The claim remains active. You can ask to cancel again if you still want it gone.'
    : denied
      ? 'Your cancellation request was denied. The claim remains active.'
      : 'The cancellation request could not be completed. The claim remains active.'
  await addMessage(claimId, 'assistant', content)
}
