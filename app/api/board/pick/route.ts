import { NextResponse } from 'next/server'
import { requireHostSession } from '@/lib/api-auth'
import { pickBoard } from '@/lib/board'
import { hasCibaCatchUpLock } from '@/lib/board-config'

export async function POST() {
  const auth = await requireHostSession()
  if ('error' in auth) return auth.error

  if (await hasCibaCatchUpLock()) {
    return NextResponse.json(
      { error: 'A claim is in CIBA or waiting on the calendar write. Reset it before picking again.' },
      { status: 409 },
    )
  }

  try {
    const board = await pickBoard(auth.session.user.sub)
    return NextResponse.json({ board })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pick failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
