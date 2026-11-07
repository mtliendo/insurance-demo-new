import { NextResponse } from 'next/server'
import { auth0, generatePolicyId, policyIdFromUser } from '@/lib/auth0'
import { pollCancelCibaForClaim } from '@/lib/ciba-cancel'
import { tryWriteHostCalendarEvent } from '@/lib/ciba-flow'
import { addMessage, createClaim, getClaim, getLatestClaimForUser } from '@/lib/claims'
import { isBoardDemoEnabled } from '@/lib/demo-flags'
import { buildClaimSnapshot } from '@/lib/snapshot'
import type { ClaimSnapshot } from '@/lib/types'

const GREETINGS = [
  "Hi there! I'm here to help you file your superhero insurance claim. Can you tell me what happened?",
  "Welcome! Let's get your claim started. What seems to be the issue?",
  "Hello! I'm your claims assistant. Please describe the incident you need to file a claim for.",
  'Greetings, superhero! Ready to file a claim? Tell me about the situation.',
  "Hey! I'll guide you through filing your claim. What brings you here today?",
]

const CALENDAR_CONNECTED_CHAT =
  'Google Calendar is connected now — I added this claim to your calendar.'

/**
 * Starts a claim, or resumes the caller's most recent one (any status) so
 * a Settings detour does not wipe the chat. Pass `{ newChat: true }` to
 * start a fresh pending row instead of resuming.
 */
export async function POST(request: Request) {
  const session = await auth0.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let newChat = false
  if (request.headers.get('content-type')?.includes('application/json')) {
    const body = (await request.json().catch(() => null)) as {
      newChat?: unknown
    } | null
    newChat = body?.newChat === true
  }

  const userId = session.user.sub
  const existing = newChat ? null : await getLatestClaimForUser(userId)

  if (existing) {
    if (existing.cancelCibaStatus === 'pending') {
      await pollCancelCibaForClaim(existing.id)
    }
    if (!isBoardDemoEnabled()) {
      const wrote = await tryWriteHostCalendarEvent(existing.id, session.user)
      if (wrote === 'written') {
        await addMessage(existing.id, 'assistant', CALENDAR_CONNECTED_CHAT)
      }
    }
    const latest = (await getClaim(existing.id)) ?? existing
    const snapshot: ClaimSnapshot = await buildClaimSnapshot(latest)
    return NextResponse.json(snapshot)
  }

  // Prefer the namespaced claim the Auth0 Action adds; fall back if it isn't set up.
  const policyId = policyIdFromUser(session.user) ?? generatePolicyId()
  const claim = await createClaim(userId, policyId)

  const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)]
  await addMessage(claim.id, 'assistant', greeting)

  const snapshot: ClaimSnapshot = await buildClaimSnapshot(claim)
  return NextResponse.json(snapshot)
}
