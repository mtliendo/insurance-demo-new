import { NextResponse } from 'next/server'
import { requireHostSession } from '@/lib/api-auth'
import { clearCurrentClaims } from '@/lib/claims'

/**
 * Host-only rehearsal reset. Audience / joiners / the seated board get 403.
 * Wipes the projector claim (including approved + calendar written)
 * and cascaded chat / CIBA — not the room, board, or Google event.
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
