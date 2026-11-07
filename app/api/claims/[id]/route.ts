import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { pollCancelCibaForClaim } from '@/lib/ciba-cancel'
import { pollCibaForClaim } from '@/lib/ciba-flow'
import { getClaim } from '@/lib/claims'
import { isAdmin } from '@/lib/host'
import { isCibaCatchUpWindow } from '@/lib/board-config'
import { buildClaimSnapshot } from '@/lib/snapshot'
import type { ClaimSnapshot } from '@/lib/types'

/**
 * The polling endpoint. Stands in for the AppSync Events subscription the Vite
 * app opened on `interviewDemo/attendee` — the client asks for the whole claim
 * snapshot on an interval instead of reacting to pushed events.
 *
 * Host sessions tick due board CIBA auth_req_ids (stored interval, floor 5s).
 * Audience GETs read Neon only for the board grant — they must not hammer
 * /oauth/token. The claim owner may tick their own cancel-claim CIBA.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth0.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params
  let claim = await getClaim(id)

  if (!claim || claim.userId !== session.user.sub) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (claim.cancelCibaStatus === 'pending') {
    await pollCancelCibaForClaim(claim.id)
    claim = (await getClaim(id)) ?? claim
  }

  const hostPolling = isAdmin(session.user)
  if (hostPolling && isCibaCatchUpWindow(claim)) {
    claim = (await pollCibaForClaim(claim.id, session.user)) ?? claim
  }

  const snapshot: ClaimSnapshot = await buildClaimSnapshot(claim)
  return NextResponse.json(snapshot)
}
