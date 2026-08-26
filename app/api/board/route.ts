import { NextResponse } from 'next/server'
import { requireHostSession } from '@/lib/api-auth'
import { eligibleJoiners, getCurrentBoard, listJoiners } from '@/lib/board'
import { hasLiveCiba } from '@/lib/ciba-store'
import { pollCibaForClaim } from '@/lib/ciba-flow'
import { getLatestSubmittedClaim } from '@/lib/claims'
import { isGoogleConnected } from '@/lib/google'
import { getCibaBoardSnapshot } from '@/lib/snapshot'
import { BOARD_SIZE } from '@/lib/types'

export async function GET() {
  const auth = await requireHostSession()
  if ('error' in auth) return auth.error

  let claim = await getLatestSubmittedClaim()
  if (claim && (claim.status === 'awaiting_approval' || (claim.status === 'approved' && !claim.calendarEventId))) {
    claim = (await pollCibaForClaim(claim.id, auth.session.user)) ?? claim
  }

  const [joiners, board, googleConnected, liveCiba] = await Promise.all([
    listJoiners(),
    getCurrentBoard(),
    isGoogleConnected(),
    hasLiveCiba(),
  ])

  return NextResponse.json({
    joiners,
    board,
    boardSize: BOARD_SIZE,
    verifiedCount: eligibleJoiners(joiners).length,
    canPick: !liveCiba,
    googleConnected,
    claim: claim
      ? {
          id: claim.id,
          status: claim.status,
          policyId: claim.policyId,
          incidentDescription: claim.incidentDescription,
          calendarEventId: claim.calendarEventId,
          board: await getCibaBoardSnapshot(claim),
        }
      : null,
  })
}
