import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  getApprovalCount,
  getClaimsAwaitingApproval,
  hasApproved,
  recordApproval,
} from '@/lib/claims'
import { REQUIRED_APPROVALS, TOTAL_APPROVERS } from '@/lib/types'

const APPROVER_COOKIE = 'approver_id'

async function readApproverId(): Promise<string | null> {
  const store = await cookies()
  return store.get(APPROVER_COOKIE)?.value ?? null
}

export interface ApprovalQueueItem {
  claimId: string
  policyId: string
  incidentDescription: string | null
  incidentLocation: string | null
  damageExtent: string | null
  status: string
  approvalCount: number
  totalApprovers: number
  requiredApprovals: number
  alreadyApproved: boolean
}

/**
 * Public queue for the audience approver screen. Deliberately unauthenticated —
 * this is the demo's participation moment, and it exposes no user identity.
 */
export async function GET() {
  const approverId = await readApproverId()
  const claims = await getClaimsAwaitingApproval()

  const items: ApprovalQueueItem[] = await Promise.all(
    claims.map(async (claim) => ({
      claimId: claim.id,
      policyId: claim.policyId,
      incidentDescription: claim.incidentDescription,
      incidentLocation: claim.incidentLocation,
      damageExtent: claim.damageExtent,
      status: claim.status,
      approvalCount: await getApprovalCount(claim.id),
      totalApprovers: TOTAL_APPROVERS,
      requiredApprovals: REQUIRED_APPROVALS,
      alreadyApproved: approverId
        ? await hasApproved(claim.id, approverId)
        : false,
    })),
  )

  return NextResponse.json({ claims: items })
}

/** Records one approval. Replaces publishing a CLAIM_APPROVAL event. */
export async function POST(request: Request) {
  const { claimId } = (await request.json()) as { claimId?: string }
  if (!claimId) {
    return NextResponse.json({ error: 'claimId is required' }, { status: 400 })
  }

  // One vote per browser. Anonymous by design — no account needed to approve.
  let approverId = await readApproverId()
  const isNewApprover = !approverId
  approverId ??= crypto.randomUUID()

  const approvalCount = await recordApproval(claimId, approverId)

  const response = NextResponse.json({
    approvalCount,
    requiredApprovals: REQUIRED_APPROVALS,
    totalApprovers: TOTAL_APPROVERS,
  })

  if (isNewApprover) {
    response.cookies.set(APPROVER_COOKIE, approverId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    })
  }

  return response
}
