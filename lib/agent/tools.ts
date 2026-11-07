import { tool } from 'ai'
import { z } from 'zod'
import { requestCancelClaim } from '@/lib/ciba-cancel'
import {
  cibaStartAgentMessage,
  startCibaForSubmittedClaim,
  tryWriteHostCalendarEvent,
} from '@/lib/ciba-flow'
import { isBoardDemoEnabled } from '@/lib/demo-flags'
import { auth0 } from '@/lib/auth0'
import {
  approveClaimWithoutBoard,
  flagFraud,
  getClaim,
  saveClaimDetails,
  submitClaim,
} from '@/lib/claims'
import {
  MOCK_VEHICLE_DATA,
  SETTINGS_CHAT_LINK,
} from '@/lib/agent/system-prompt'
import type { Claim } from '@/lib/types'

function googleCalendarNotConnectedToolResult(): string {
  return [
    'Google Calendar is not connected, so no Token Vault event was written.',
    `Tell the user to connect Google Calendar in ${SETTINGS_CHAT_LINK}. Include that markdown link in your reply.`,
    'Tell them to come back to this same chat after connecting — the full conversation and claim will still be here.',
    'Do not tell them to start a new claim. Do not mention a CIBA board or QR.',
  ].join(' ')
}

async function writeCalendarOrExplain(claimId: string): Promise<string> {
  const session = await auth0.getSession()
  if (!session) {
    return 'Not signed in. The calendar event was not written.'
  }
  const result = await tryWriteHostCalendarEvent(claimId, session.user)
  switch (result) {
    case 'written':
      return 'A Google Calendar event was written via Auth0 Token Vault. Tell the user it is on the calendar.'
    case 'already':
      return 'A Google Calendar event is already on this claim. Tell the user it is already on the calendar.'
    case 'no_google':
      return googleCalendarNotConnectedToolResult()
    case 'not_admin':
      return 'This session is not an admin, so Token Vault did not write a calendar event.'
    case 'skipped':
      return 'No calendar write for this claim status. If they still need to file, use publish_claim_submission.'
    default:
      return 'Could not write the calendar event. Tell the user to try again. Do not say the demo is broken.'
  }
}

/**
 * AI SDK tools for one claim. Each execute writes Neon, then the agent
 * loop re-reads the row so the next system prompt matches the database.
 */
export function claimTools(claim: Claim, actor: { sub: string }) {
  return {
    save_claim_details: tool({
      description:
        'Save the claim details once you have collected all necessary information: incident description, location, and damage extent. Only call this when you have all three pieces of information.',
      inputSchema: z.object({
        incidentDescription: z
          .string()
          .describe(
            'A detailed description of what happened (e.g. "The Hulk threw my car across the street")',
          ),
        incidentLocation: z
          .string()
          .describe('Where the incident occurred (e.g. "Downtown parking lot on 5th Avenue")'),
        damageExtent: z
          .string()
          .describe(
            'The severity of damage to the vehicle (e.g. "Totaled", "Minor dents", "Windshield cracked")',
          ),
      }),
      execute: async ({ incidentDescription, incidentLocation, damageExtent }) => {
        await saveClaimDetails(claim.id, {
          incidentDescription,
          incidentLocation,
          damageExtent,
        })

        return `Claim details saved successfully. Present the following summary to the user and ask if they want to submit:

CLAIM SUMMARY:
- Vehicle: ${MOCK_VEHICLE_DATA.year} ${MOCK_VEHICLE_DATA.color} ${MOCK_VEHICLE_DATA.make} ${MOCK_VEHICLE_DATA.model}
- Incident: ${incidentDescription}
- Location: ${incidentLocation}
- Damage: ${damageExtent}
- Policy Number: ${claim.policyId}

Ask the user if they are ready to submit this claim for processing.`
      },
    }),

    notify_fraud: tool({
      description: 'Notify the fraud department of a potential fraudulent claim.',
      inputSchema: z.object({
        fraudType: z.string().describe('The type of suspected fraud'),
        fraudDescription: z.string().describe('Why this claim looks fraudulent'),
      }),
      execute: async ({ fraudType, fraudDescription }) => {
        await flagFraud(claim.id, `${fraudType}: ${fraudDescription}`)
        return 'Fraud department notified successfully.'
      },
    }),

    publish_claim_submission: tool({
      description: isBoardDemoEnabled()
        ? 'Submit the claim after the user explicitly confirms they want it sent. Flips the claim to awaiting_approval. Starts CIBA only from the host session (same grant as POST /api/ciba). A non-host filer gets not_host — the operator console on /host starts CIBA automatically. The tool result says whether mail went out, that the console is starting it, or why it is blocked. Tell the user that. If not_host, say the board is being emailed / it is starting. Do not tell a non-host to click Send CIBA. Do not claim the board was emailed unless the result says CIBA started, is already live, or not_host (console will start it).'
        : 'Submit the claim after the user explicitly confirms they want it sent. Marks it approved and writes one Google Calendar event via Auth0 Token Vault when this session is an admin with Google connected. Do not mention a CIBA board, QR, or seated members. Tell the user whether the calendar event was written.',
      inputSchema: z.object({
        confirmSubmission: z
          .boolean()
          .describe('Whether the user confirmed they want to submit the claim'),
      }),
      execute: async ({ confirmSubmission }) => {
        if (confirmSubmission !== true) {
          return 'Claim submission cancelled. Ask the user if they would like to make any changes before submitting.'
        }
        await submitClaim(claim.id)
        if (isBoardDemoEnabled()) {
          const ciba = await startCibaForSubmittedClaim(claim.id)
          return cibaStartAgentMessage(ciba)
        }
        await approveClaimWithoutBoard(claim.id)
        const calendar = await writeCalendarOrExplain(claim.id)
        return [
          'Claim submitted and approved.',
          calendar,
          'Do not mention a CIBA board or QR.',
        ].join(' ')
      },
    }),

    ...(isBoardDemoEnabled()
      ? {}
      : {
          write_calendar_event: tool({
            description:
              'Write this filed claim to Google Calendar via Auth0 Token Vault. Call when the user asks to put the claim on the calendar and it is already submitted, or after they connect Google in Settings and come back. If Google is not connected, the result tells them to open Settings — include that link. Do not mention a CIBA board or QR.',
            inputSchema: z.object({
              confirm: z
                .boolean()
                .optional()
                .describe('True when they asked to put this claim on the calendar'),
            }),
            execute: async () => {
              const latest = (await getClaim(claim.id)) ?? claim
              if (latest.status === 'cancelled') {
                return 'This claim is cancelled. Do not write a calendar event.'
              }
              if (latest.status === 'pending') {
                return 'The claim is not submitted yet. If they confirmed they want it filed and on the calendar, use publish_claim_submission instead.'
              }
              return writeCalendarOrExplain(latest.id)
            },
          }),
        }),

    cancel_claim: tool({
      description:
        'Cancel this claim after the user asks to cancel it. Starts a CIBA email to the signed-in user (login_hint iss_sub of this session, binding message Cancel-claim-#<id>) and returns immediately while status is pending. Do not ask for a second chat confirmation — the email is the confirmation. Call this when they say "cancel my claim" or name this claim. Tell them to check their email and Accept. Do not say the claim is cancelled, denied, or timed out unless the tool result says so. The page polls Auth0 until they Accept, Decline, or the request expires (~5 minutes).',
      inputSchema: z.object({
        claimId: z
          .string()
          .optional()
          .describe(
            'Claim id if the user named one. Omit to cancel the claim in this chat.',
          ),
      }),
      execute: async ({ claimId }) => requestCancelClaim(claim, claimId, actor),
    }),
  }
}
