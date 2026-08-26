import { NextResponse } from 'next/server'
import { requireHostSession } from '@/lib/api-auth'
import { startCibaForSubmittedClaim } from '@/lib/ciba-flow'
import { getClaim, getLatestSubmittedClaim } from '@/lib/claims'
import { getCibaBoardSnapshot } from '@/lib/snapshot'

export async function GET() {
  const auth = await requireHostSession()
  if ('error' in auth) return auth.error

  const claim = await getLatestSubmittedClaim()
  if (!claim) {
    return NextResponse.json({ claim: null, board: null })
  }

  return NextResponse.json({
    claim: { id: claim.id, status: claim.status },
    board: await getCibaBoardSnapshot(claim),
  })
}

/** Manual start if submit happened before Google was connected or a board was picked. */
export async function POST() {
  const auth = await requireHostSession()
  if ('error' in auth) return auth.error

  const claim = await getLatestSubmittedClaim()
  if (!claim || claim.status !== 'awaiting_approval') {
    return NextResponse.json({ error: 'No claim waiting on the board.' }, { status: 400 })
  }

  const result = await startCibaForSubmittedClaim(claim.id)
  if (!result.ok) {
    const status = result.reason === 'not_host' ? 403 : 409
    return NextResponse.json({ error: result.reason }, { status })
  }

  const next = await getClaim(claim.id)
  return NextResponse.json({
    started: result.started,
    board: next ? await getCibaBoardSnapshot(next) : null,
  })
}
