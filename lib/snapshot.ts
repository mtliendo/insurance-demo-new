import { getCurrentBoard } from '@/lib/board'
import { getBoardSettings } from '@/lib/board-config'
import { listCibaForClaim, toCibaMember } from '@/lib/ciba-store'
import { getApprovalCount, listMessages } from '@/lib/claims'
import { isGoogleConnected } from '@/lib/google'
import type { CibaBoardSnapshot, Claim, ClaimSnapshot } from '@/lib/types'

export async function getCibaBoardSnapshot(claim: Claim): Promise<CibaBoardSnapshot> {
  const { boardSize, yesThreshold } = await getBoardSettings()
  const rows = await listCibaForClaim(claim.id)
  if (rows.length > 0) {
    const members = rows.map(toCibaMember)
    return {
      members,
      approvedCount: members.filter((m) => m.status === 'approved').length,
      requiredApprovals: yesThreshold,
      boardSize,
      blockReason: claim.cibaBlockReason,
      calendarEventId: claim.calendarEventId,
      started: true,
    }
  }

  const seated = await getCurrentBoard()
  return {
    members: seated.map((m) => ({
      sub: m.sub,
      email: m.email,
      name: m.name,
      status: 'pending' as const,
    })),
    approvedCount: 0,
    requiredApprovals: yesThreshold,
    boardSize,
    blockReason: claim.cibaBlockReason,
    calendarEventId: claim.calendarEventId,
    started: false,
  }
}

export async function buildClaimSnapshot(claim: Claim): Promise<ClaimSnapshot> {
  const [messages, likeCount, board, googleConnected] = await Promise.all([
    listMessages(claim.id),
    getApprovalCount(claim.id),
    getCibaBoardSnapshot(claim),
    isGoogleConnected(),
  ])

  return {
    claim,
    messages,
    likeCount,
    approvalCount: board.approvedCount,
    board,
    googleConnected,
  }
}
