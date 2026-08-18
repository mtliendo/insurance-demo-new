import { sql } from '@/lib/db'
import type { Claim, ChatMessage, ClaimStatus } from '@/lib/types'
import { REQUIRED_APPROVALS } from '@/lib/types'

type ClaimRow = {
  id: string
  user_id: string
  policy_id: string
  incident_description: string | null
  incident_location: string | null
  damage_extent: string | null
  status: ClaimStatus
  fraud_flagged: boolean
  created_at: Date | string
}

function toClaim(row: ClaimRow): Claim {
  return {
    id: row.id,
    userId: row.user_id,
    policyId: row.policy_id,
    incidentDescription: row.incident_description,
    incidentLocation: row.incident_location,
    damageExtent: row.damage_extent,
    status: row.status,
    fraudFlagged: row.fraud_flagged,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export async function createClaim(userId: string, policyId: string): Promise<Claim> {
  const rows = (await sql`
    insert into claims (user_id, policy_id)
    values (${userId}, ${policyId})
    returning *
  `) as ClaimRow[]
  return toClaim(rows[0])
}

export async function getClaim(id: string): Promise<Claim | null> {
  const rows = (await sql`select * from claims where id = ${id}`) as ClaimRow[]
  return rows[0] ? toClaim(rows[0]) : null
}

/** Most recent claim for a user — lets the file-claim page resume instead of restarting. */
export async function getLatestClaimForUser(userId: string): Promise<Claim | null> {
  const rows = (await sql`
    select * from claims
    where user_id = ${userId} and status <> 'approved'
    order by created_at desc
    limit 1
  `) as ClaimRow[]
  return rows[0] ? toClaim(rows[0]) : null
}

/** The public approver queue: claims the audience can vote on. */
export async function getClaimsAwaitingApproval(): Promise<Claim[]> {
  const rows = (await sql`
    select * from claims
    where status in ('awaiting_approval', 'approved')
    order by created_at desc
    limit 10
  `) as ClaimRow[]
  return rows.map(toClaim)
}

export async function listMessages(claimId: string): Promise<ChatMessage[]> {
  const rows = (await sql`
    select role, content from messages
    where claim_id = ${claimId}
    order by created_at, id
  `) as { role: 'user' | 'assistant'; content: string }[]
  return rows.map((r) => ({ role: r.role, content: r.content }))
}

export async function addMessage(
  claimId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<void> {
  await sql`
    insert into messages (claim_id, role, content)
    values (${claimId}, ${role}, ${content})
  `
}

/** Backs the save_claim_details tool. */
export async function saveClaimDetails(
  claimId: string,
  details: {
    incidentDescription: string
    incidentLocation: string
    damageExtent: string
  },
): Promise<void> {
  await sql`
    update claims set
      incident_description = ${details.incidentDescription},
      incident_location    = ${details.incidentLocation},
      damage_extent        = ${details.damageExtent},
      updated_at           = now()
    where id = ${claimId}
  `
}

/** Backs the notify_fraud tool. Silent by design — the user is never told. */
export async function flagFraud(claimId: string, reason: string): Promise<void> {
  await sql`
    update claims
    set fraud_flagged = true, fraud_reason = ${reason}, updated_at = now()
    where id = ${claimId}
  `
}

/** Backs the publish_claim_submission tool — replaces the CLAIM_SUBMITTED event. */
export async function submitClaim(claimId: string): Promise<void> {
  await sql`
    update claims
    set status = 'awaiting_approval', updated_at = now()
    where id = ${claimId} and status = 'pending'
  `
}

export async function getApprovalCount(claimId: string): Promise<number> {
  const rows = (await sql`
    select count(*)::int as count from claim_approvals where claim_id = ${claimId}
  `) as { count: number }[]
  return rows[0]?.count ?? 0
}

/**
 * Records one audience approval and promotes the claim once enough have landed.
 * Replaces the CLAIM_APPROVAL events the frontend used to count client-side.
 * The unique (claim_id, approver_id) constraint makes repeat votes a no-op.
 */
export async function recordApproval(
  claimId: string,
  approverId: string,
): Promise<number> {
  await sql`
    insert into claim_approvals (claim_id, approver_id)
    values (${claimId}, ${approverId})
    on conflict (claim_id, approver_id) do nothing
  `

  const count = await getApprovalCount(claimId)

  if (count >= REQUIRED_APPROVALS) {
    await sql`
      update claims set status = 'approved', updated_at = now()
      where id = ${claimId} and status = 'awaiting_approval'
    `
  }

  return count
}

export async function hasApproved(claimId: string, approverId: string): Promise<boolean> {
  const rows = (await sql`
    select 1 from claim_approvals
    where claim_id = ${claimId} and approver_id = ${approverId}
    limit 1
  `) as unknown[]
  return rows.length > 0
}
