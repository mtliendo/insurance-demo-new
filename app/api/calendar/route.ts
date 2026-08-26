import { NextResponse } from 'next/server'
import { requireHostSession } from '@/lib/api-auth'
import { getGoogleAccessToken } from '@/lib/google'
import { createEvent } from '@/lib/google-calendar'

/**
 * Host-only calendar write via Auth0 Token Vault.
 * Board members never hit this — only Focus connects Google.
 */
export async function POST(request: Request) {
  const auth = await requireHostSession()
  if ('error' in auth) return auth.error

  const token = await getGoogleAccessToken()
  if (!token) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 403 })
  }

  const body = (await request.json()) as {
    summary?: string
    description?: string
    location?: string
    startDateTime?: string
    endDateTime?: string
    timeZone?: string
  }

  if (!body.summary || !body.startDateTime || !body.endDateTime) {
    return NextResponse.json(
      { error: 'summary, startDateTime, and endDateTime are required' },
      { status: 400 },
    )
  }

  const event = await createEvent(token, {
    summary: body.summary,
    description: body.description,
    location: body.location,
    startDateTime: body.startDateTime,
    endDateTime: body.endDateTime,
    timeZone: body.timeZone,
  })

  return NextResponse.json({ event }, { status: 201 })
}
