import { bindingMessageForCancel } from '@/lib/binding-message'
import { cancelCibaWaitMs, startCiba, waitForCiba } from '@/lib/ciba'
import { cancelClaim, getClaim } from '@/lib/claims'
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

/**
 * CIBA-gated cancel for the claim in this chat. Emails the policyholder
 * (`login_hint` iss_sub = `claim.userId`), waits for approval, then
 * flips status to `cancelled`. Does not touch the board grant, Token
 * Vault, or `ciba_authorizations`.
 */
export async function requestCancelClaim(
  claim: Claim,
  namedClaimId?: string,
): Promise<string> {
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

  const bindingMessage = bindingMessageForCancel(latest.id)

  let started: Awaited<ReturnType<typeof startCiba>>
  try {
    started = await startCiba(latest.userId, bindingMessage)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'bc-authorize failed'
    return [
      `Could not start CIBA (${message}). The claim was NOT cancelled.`,
      'Tell the user we could not send the approval email.',
      'They need a verified email, and the Auth0 app needs the CIBA grant plus the email channel.',
      'Do not say the demo is broken.',
    ].join(' ')
  }

  const waited = await waitForCiba(started.authReqId, {
    timeoutMs: cancelCibaWaitMs(),
    intervalSec: started.interval,
  })

  if (waited.status === 'approved') {
    try {
      const cancelled = await cancelClaim(latest.id)
      if (!cancelled) {
        return [
          'CIBA was approved, but the claim could not be cancelled (it may already be cancelled).',
          'Tell the user to refresh if the manifest does not show Cancelled.',
        ].join(' ')
      }
      return [
        `CIBA approved. Claim ${latest.id} is now cancelled.`,
        'Tell the user the claim is cancelled and the manifest should show Cancelled.',
      ].join(' ')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'update failed'
      return [
        `CIBA was approved, but saving cancelled failed (${message}).`,
        'The claim may still show its previous status. Tell the user to refresh.',
        'Do not say the demo is broken.',
      ].join(' ')
    }
  }

  if (waited.status === 'denied') {
    return [
      'CIBA was denied or the Auth0 request expired. The claim was NOT cancelled and is unchanged.',
      'Tell the user that.',
    ].join(' ')
  }

  if (waited.status === 'timeout') {
    return [
      'Timed out waiting for the CIBA email approval. The claim was NOT cancelled.',
      'Tell the user to check their email (binding message starts with Cancel-claim-#)',
      'and ask again if they still want to cancel.',
    ].join(' ')
  }

  return [
    `CIBA error (${waited.error || 'unknown'}). The claim was NOT cancelled.`,
    'Tell the user that. Do not say the demo is broken.',
  ].join(' ')
}
