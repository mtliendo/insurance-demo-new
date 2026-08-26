import type Anthropic from '@anthropic-ai/sdk'
import { startCibaForSubmittedClaim } from '@/lib/ciba-flow'
import { flagFraud, saveClaimDetails, submitClaim } from '@/lib/claims'
import { MOCK_VEHICLE_DATA } from '@/lib/agent/system-prompt'
import type { Claim } from '@/lib/types'

export const tools: Anthropic.Tool[] = [
  {
    name: 'save_claim_details',
    description:
      'Save the claim details once you have collected all necessary information: incident description, location, and damage extent. Only call this when you have all three pieces of information.',
    input_schema: {
      type: 'object',
      properties: {
        incidentDescription: {
          type: 'string',
          description:
            'A detailed description of what happened (e.g. "The Hulk threw my car across the street")',
        },
        incidentLocation: {
          type: 'string',
          description:
            'Where the incident occurred (e.g. "Downtown parking lot on 5th Avenue")',
        },
        damageExtent: {
          type: 'string',
          description:
            'The severity of damage to the vehicle (e.g. "Totaled", "Minor dents", "Windshield cracked")',
        },
      },
      required: ['incidentDescription', 'incidentLocation', 'damageExtent'],
    },
  },
  {
    name: 'notify_fraud',
    description: 'Notify the fraud department of a potential fraudulent claim.',
    input_schema: {
      type: 'object',
      properties: {
        fraudType: { type: 'string', description: 'The type of suspected fraud' },
        fraudDescription: {
          type: 'string',
          description: 'Why this claim looks fraudulent',
        },
      },
      required: ['fraudType', 'fraudDescription'],
    },
  },
  {
    name: 'publish_claim_submission',
    description:
      'Submit the claim for processing after the user explicitly confirms they want to submit. This sends the claim to the processing team for approval.',
    input_schema: {
      type: 'object',
      properties: {
        confirmSubmission: {
          type: 'boolean',
          description: 'Whether the user confirmed they want to submit the claim',
        },
      },
      required: ['confirmSubmission'],
    },
  },
]

/**
 * Executes one tool call against Neon. The CDK version mutated an in-memory
 * object and published to AppSync; every branch here writes to the database
 * instead, which is what the polling endpoint reads back.
 */
export async function runTool(
  claim: Claim,
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case 'save_claim_details': {
      const details = {
        incidentDescription: String(input.incidentDescription),
        incidentLocation: String(input.incidentLocation),
        damageExtent: String(input.damageExtent),
      }
      await saveClaimDetails(claim.id, details)

      return `Claim details saved successfully. Present the following summary to the user and ask if they want to submit:

CLAIM SUMMARY:
- Vehicle: ${MOCK_VEHICLE_DATA.year} ${MOCK_VEHICLE_DATA.color} ${MOCK_VEHICLE_DATA.make} ${MOCK_VEHICLE_DATA.model}
- Incident: ${details.incidentDescription}
- Location: ${details.incidentLocation}
- Damage: ${details.damageExtent}
- Policy Number: ${claim.policyId}

Ask the user if they are ready to submit this claim for processing.`
    }

    case 'notify_fraud': {
      await flagFraud(
        claim.id,
        `${String(input.fraudType)}: ${String(input.fraudDescription)}`,
      )
      return 'Fraud department notified successfully.'
    }

    case 'publish_claim_submission': {
      if (!input.confirmSubmission) {
        return 'Claim submission cancelled. Ask the user if they would like to make any changes before submitting.'
      }
      await submitClaim(claim.id)
      await startCibaForSubmittedClaim(claim.id)
      return 'Claim submitted successfully. Thank the user and let them know the Claim Processing team will review this claim and provide a status update.'
    }

    default:
      return `Unknown tool: ${name}`
  }
}
