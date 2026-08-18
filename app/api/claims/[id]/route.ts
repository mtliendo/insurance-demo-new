import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getApprovalCount, getClaim, listMessages } from '@/lib/claims'
import type { ClaimSnapshot } from '@/lib/types'

/**
 * The polling endpoint. Stands in for the AppSync Events subscription the Vite
 * app opened on `interviewDemo/attendee` — the client asks for the whole claim
 * snapshot on an interval instead of reacting to pushed events.
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
  const claim = await getClaim(id)

  if (!claim || claim.userId !== session.user.sub) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const snapshot: ClaimSnapshot = {
    claim,
    messages: await listMessages(claim.id),
    approvalCount: await getApprovalCount(claim.id),
  }
  return NextResponse.json(snapshot)
}
