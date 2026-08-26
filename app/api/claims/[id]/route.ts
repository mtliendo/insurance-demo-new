import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { pollCibaForClaim } from '@/lib/ciba-flow'
import { getClaim } from '@/lib/claims'
import { buildClaimSnapshot } from '@/lib/snapshot'
import type { ClaimSnapshot } from '@/lib/types'

/**
 * The polling endpoint. Stands in for the AppSync Events subscription the Vite
 * app opened on `interviewDemo/attendee` — the client asks for the whole claim
 * snapshot on an interval instead of reacting to pushed events.
 *
 * While the claim is awaiting the CIBA board, each poll also ticks
 * /oauth/token per auth_req_id we minted.
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

  if (claim.status === 'awaiting_approval' || (claim.status === 'approved' && !claim.calendarEventId)) {
    claim = (await pollCibaForClaim(claim.id)) ?? claim
  }

  const snapshot: ClaimSnapshot = await buildClaimSnapshot(claim)
  return NextResponse.json(snapshot)
}
