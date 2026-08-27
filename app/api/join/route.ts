import { NextResponse } from 'next/server'
import { emailVerifiedFromUser } from '@/lib/auth0'
import { requireSession } from '@/lib/api-auth'
import { getJoiner, isOnCurrentBoard, upsertJoiner } from '@/lib/board'
import { getBoardSettings } from '@/lib/board-config'
import { getCibaForSub } from '@/lib/ciba-store'
import { getLatestSubmittedClaim } from '@/lib/claims'
import { isDemoHost, isHostIdentity } from '@/lib/host'

export async function GET() {
  const auth = await requireSession()
  if ('error' in auth) return auth.error

  const { user } = auth.session
  const joiner = await getJoiner(user.sub)
  const onBoard = await isOnCurrentBoard(user.sub)
  const claim = await getLatestSubmittedClaim()
  const [ciba, settings] = await Promise.all([
    claim ? getCibaForSub(claim.id, user.sub) : Promise.resolve(null),
    getBoardSettings(),
  ])

  return NextResponse.json({
    host: isDemoHost(user),
    joiner,
    onBoard,
    emailVerified: emailVerifiedFromUser(user),
    boardSize: settings.boardSize,
    claimStatus: claim?.status ?? null,
    ciba: ciba
      ? { status: ciba.status, bindingMessage: ciba.binding_message, error: ciba.error }
      : null,
  })
}

export async function POST() {
  const auth = await requireSession()
  if ('error' in auth) return auth.error

  const { user } = auth.session
  const email = typeof user.email === 'string' ? user.email : ''
  const name = typeof user.name === 'string' && user.name ? user.name : email || 'Joiner'
  const emailVerified = emailVerifiedFromUser(user)

  if (isHostIdentity(user.sub, email)) {
    const settings = await getBoardSettings()
    return NextResponse.json({
      host: true,
      joiner: null,
      onBoard: false,
      emailVerified,
      boardSize: settings.boardSize,
      skipped: 'host',
    })
  }

  if (!email) {
    return NextResponse.json({ error: 'Auth0 profile is missing an email.' }, { status: 400 })
  }

  const joiner = await upsertJoiner({
    sub: user.sub,
    email,
    name,
    emailVerified,
  })

  return NextResponse.json({
    host: false,
    joiner,
    onBoard: await isOnCurrentBoard(user.sub),
    emailVerified,
    boardSize: (await getBoardSettings()).boardSize,
  })
}
