import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { runAgent } from '@/lib/agent/run'
import { addMessage, getClaim, listMessages } from '@/lib/claims'
import { buildClaimSnapshot } from '@/lib/snapshot'
import type { ClaimSnapshot } from '@/lib/types'

export const maxDuration = 60

/**
 * One conversational turn. Replaces `POST /ai-agent` on the API Gateway HTTP
 * API — the Auth0 session check here does the job the HttpJwtAuthorizer did.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth0.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params
  const claim = await getClaim(id)

  if (!claim || claim.userId !== session.user.sub) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { message } = (await request.json()) as { message?: string }
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  await addMessage(claim.id, 'user', message.trim())
  const history = await listMessages(claim.id)

  try {
    const { reply, claim: updated } = await runAgent(claim, history)
    await addMessage(claim.id, 'assistant', reply)

    const snapshot: ClaimSnapshot = await buildClaimSnapshot(updated)
    return NextResponse.json(snapshot)
  } catch (error) {
    console.error('Agent error:', error)
    const fallback = 'Sorry, I encountered an error. Please try again in a moment.'
    await addMessage(claim.id, 'assistant', fallback)

    const snapshot: ClaimSnapshot = await buildClaimSnapshot(claim)
    return NextResponse.json(
      {
        ...snapshot,
        messages: [...history, { role: 'assistant', content: fallback }],
      },
      { status: 500 },
    )
  }
}
