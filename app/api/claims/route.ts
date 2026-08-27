import { NextResponse } from 'next/server'
import { auth0, generatePolicyId } from '@/lib/auth0'
import { addMessage, createClaim, getLatestClaimForUser } from '@/lib/claims'
import { buildClaimSnapshot } from '@/lib/snapshot'
import type { ClaimSnapshot } from '@/lib/types'

const GREETINGS = [
  "Hi there! I'm here to help you file your superhero insurance claim. Can you tell me what happened?",
  "Welcome! Let's get your claim started. What seems to be the issue?",
  "Hello! I'm your claims assistant. Please describe the incident you need to file a claim for.",
  'Greetings, superhero! Ready to file a claim? Tell me about the situation.',
  "Hey! I'll guide you through filing your claim. What brings you here today?",
]

/**
 * Starts a claim, or resumes the caller's most recent unapproved one. The Vite
 * app generated a policy number in the browser and held the claim in React
 * state; here it is a row keyed to the Auth0 `sub`.
 */
export async function POST() {
  const session = await auth0.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.sub
  const existing = await getLatestClaimForUser(userId)

  if (existing) {
    const snapshot: ClaimSnapshot = await buildClaimSnapshot(existing)
    return NextResponse.json(snapshot)
  }

  // Prefer the namespaced claim the Auth0 Action adds; fall back if it isn't set up.
  const policyId = generatePolicyId()
  const claim = await createClaim(userId, policyId)

  const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)]
  await addMessage(claim.id, 'assistant', greeting)

  const snapshot: ClaimSnapshot = await buildClaimSnapshot(claim)
  return NextResponse.json(snapshot)
}
