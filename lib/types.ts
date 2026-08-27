export type ClaimStatus = 'pending' | 'awaiting_approval' | 'approved' | 'denied'

export type CibaStatus = 'pending' | 'approved' | 'denied' | 'error'

export type CibaBlockReason = 'no_google' | 'no_board'

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
  calendarEventId: string | null
  cibaBlockReason: CibaBlockReason | null
  /** Frozen at CIBA start. Null until emails go out. */
  cibaBoardSize: number | null
  cibaYesThreshold: number | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface CibaBoardMember {
  sub: string
  email: string
  name: string
  status: CibaStatus
  bindingMessage?: string
  error?: string | null
}

export interface CibaBoardSnapshot {
  members: CibaBoardMember[]
  approvedCount: number
  requiredApprovals: number
  boardSize: number
  blockReason: CibaBlockReason | null
  calendarEventId: string | null
  started: boolean
}

/** The claim page polls this; it replaces the AppSync Events subscription. */
export interface ClaimSnapshot {
  claim: Claim
  messages: ChatMessage[]
  /** Anonymous /approve ticker. Does not release the claim. */
  likeCount: number
  /** CIBA yeses — this is the grant. */
  approvalCount: number
  board: CibaBoardSnapshot
  googleConnected: boolean
}

/**
 * Stage defaults for the CIBA board. Live size and yes-threshold are
 * stored in demo_settings and edited on /host. Clients must read the
 * values from the API / claim snapshot.
 */
export const DEFAULT_BOARD_SIZE = 6
export const DEFAULT_CIBA_YES_THRESHOLD = 3
export const MAX_BOARD_SIZE = 24

/** Kept for the public likes ticker on /approve. Not the authorization path. */
export const TOTAL_APPROVERS = 4
export const REQUIRED_APPROVALS = 3
