import { NextResponse } from 'next/server'
import { requireHostSession } from '@/lib/api-auth'
import { setJoinerPinned } from '@/lib/board'

export async function POST(request: Request) {
  const auth = await requireHostSession()
  if ('error' in auth) return auth.error

  const body = (await request.json()) as { sub?: string; pinned?: boolean }
  if (!body.sub || typeof body.pinned !== 'boolean') {
    return NextResponse.json({ error: 'sub and pinned are required' }, { status: 400 })
  }

  const joiner = await setJoinerPinned(body.sub, body.pinned)
  if (!joiner) {
    return NextResponse.json({ error: 'Joiner not found' }, { status: 404 })
  }

  return NextResponse.json({ joiner })
}
