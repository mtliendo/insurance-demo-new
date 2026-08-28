import { NextResponse } from 'next/server'
import { requireHostSession } from '@/lib/api-auth'
import { eligibleJoiners, getCurrentBoard, listJoiners, withoutHost } from '@/lib/board'
import { pollCibaForClaim } from '@/lib/ciba-flow'
import { getLatestSubmittedClaim } from '@/lib/claims'
import { isGoogleConnected } from '@/lib/google'
import { getBoardSettings, hasCibaCatchUpLock, isCibaCatchUpWindow } from '@/lib/board-config'
import { hasLiveCiba } from '@/lib/ciba-store'
import { getCibaBoardSnapshot } from '@/lib/snapshot'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireHostSession()
  if ('error' in auth) return auth.error

  let claim = await getLatestSubmittedClaim()
  if (claim && isCibaCatchUpWindow(claim)) {
    claim = (await pollCibaForClaim(claim.id, auth.session.user)) ?? claim
  }

  const [joiners, board, googleConnected, rulesLocked, cibaLive, settings] = await Promise.all([
    listJoiners(),
    getCurrentBoard(),
    isGoogleConnected(),
    hasCibaCatchUpLock(),
    hasLiveCiba(),
    getBoardSettings(),
  ])

  return NextResponse.json(
    {
      joiners: withoutHost(joiners),
      board,
      boardSize: settings.boardSize,
      yesThreshold: settings.yesThreshold,
      verifiedCount: eligibleJoiners(joiners).length,
      canPick: !cibaLive,
      canChangeRules: !rulesLocked,
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
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  )
}
