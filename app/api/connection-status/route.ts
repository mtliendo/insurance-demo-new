import { NextResponse } from 'next/server'
import { requireHostSession } from '@/lib/api-auth'
import { isGoogleConnected } from '@/lib/google'

export async function GET() {
  const auth = await requireHostSession()
  if ('error' in auth) return auth.error

  return NextResponse.json({ connected: await isGoogleConnected() })
}
