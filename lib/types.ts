export type ClaimStatus = 'pending' | 'awaiting_approval' | 'approved' | 'denied'

export interface Claim {
  id: string
  userId: string
  policyId: string
  incidentDescription: string | null
  incidentLocation: string | null
  damageExtent: string | null
  status: ClaimStatus
  fraudFlagged: boolean
  createdAt: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** The claim page polls this; it replaces the AppSync Events subscription. */
export interface ClaimSnapshot {
  claim: Claim
  messages: ChatMessage[]
  approvalCount: number
}

/** Audience members who can approve, and how many must agree. */
export const TOTAL_APPROVERS = 4
export const REQUIRED_APPROVALS = 3
