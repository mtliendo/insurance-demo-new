import { NextResponse } from 'next/server'
import { requireHostSession } from '@/lib/api-auth'
import { pollCibaForClaim } from '@/lib/ciba-flow'
import { getLatestSubmittedClaim } from '@/lib/claims'
import { getCibaBoardSnapshot } from '@/lib/snapshot'

export async function POST() {
  const auth = await requireHostSession()
  if ('error' in auth) return auth.error

  const claim = await getLatestSubmittedClaim()
  if (!claim) {
    return NextResponse.json({ claim: null, board: null })
  }

  const next = (await pollCibaForClaim(claim.id, auth.session.user)) ?? claim
  return NextResponse.json({
    claim: {
      id: next.id,
      status: next.status,
      calendarEventId: next.calendarEventId,
    },
    board: await getCibaBoardSnapshot(next),
  })
}
