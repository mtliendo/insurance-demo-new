import { NextResponse } from 'next/server'
import { requireHostSession } from '@/lib/api-auth'
import { saveBoardSettings } from '@/lib/board-config'
import { hasLiveCiba } from '@/lib/ciba-store'

export async function POST(request: Request) {
  const auth = await requireHostSession()
  if ('error' in auth) return auth.error

  if (await hasLiveCiba()) {
    return NextResponse.json(
      { error: 'CIBA emails are already out. Reset the claim before changing board rules.' },
      { status: 409 },
    )
  }

  let body: { boardSize?: unknown; yesThreshold?: unknown }
  try {
    body = (await request.json()) as { boardSize?: unknown; yesThreshold?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  try {
    const settings = await saveBoardSettings({
      boardSize: Number(body.boardSize),
      yesThreshold: Number(body.yesThreshold),
      updatedBy: auth.session.user.sub,
    })
    return NextResponse.json(settings)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Save failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
