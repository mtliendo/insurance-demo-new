import { NextResponse } from 'next/server'
import { requireHostSession } from '@/lib/api-auth'
import { clearCurrentClaims } from '@/lib/claims'

/**
 * Host-only rehearsal reset. Audience / joiners get 403.
 * Wipes the projector claim (including approved + calendar written),
 * cascaded chat / CIBA, and the seated board — not joiners,
 * demo_settings, Token Vault, or the Google event.
 */
export async function POST() {
  const auth = await requireHostSession()
  if ('error' in auth) return auth.error

  const claims = await clearCurrentClaims(auth.session.user.sub)
  return NextResponse.json({
    cleared: claims.length > 0,
    claims,
  })
}
