import { ensureBoardRulesSchema } from '@/lib/board-config'
import { sql } from '@/lib/db'
import type { ChatMessage, CibaBlockReason, Claim, ClaimStatus } from '@/lib/types'

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
  calendar_event_id: string | null
  ciba_block_reason: string | null
  ciba_board_size: number | null
  ciba_yes_threshold: number | null
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
    calendarEventId: row.calendar_event_id,
    cibaBlockReason:
      row.ciba_block_reason === 'no_google' || row.ciba_block_reason === 'no_board'
        ? row.ciba_block_reason
        : null,
    cibaBoardSize:
      row.ciba_board_size == null ? null : Number(row.ciba_board_size),
    cibaYesThreshold:
      row.ciba_yes_threshold == null ? null : Number(row.ciba_yes_threshold),
  }
}

export async function createClaim(userId: string, policyId: string): Promise<Claim> {
  await ensureBoardRulesSchema()
  const rows = (await sql`
    insert into claims (user_id, policy_id)
    values (${userId}, ${policyId})
    returning *
  `) as ClaimRow[]
  return toClaim(rows[0])
}

export async function getClaim(id: string): Promise<Claim | null> {
  await ensureBoardRulesSchema()
  const rows = (await sql`select * from claims where id = ${id}`) as ClaimRow[]
  return rows[0] ? toClaim(rows[0]) : null
}

/** Most recent claim for a user — lets the file-claim page resume instead of restarting. */
export async function getLatestClaimForUser(userId: string): Promise<Claim | null> {
  await ensureBoardRulesSchema()
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
 * Records one anonymous "like" on /approve. This is a ticker, not the grant —
 * CIBA board yeses are what release the claim.
 * The unique (claim_id, approver_id) constraint makes repeat clicks a no-op.
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

  return getApprovalCount(claimId)
}

export async function setCibaBlockReason(
  claimId: string,
  reason: CibaBlockReason | null,
): Promise<void> {
  await sql`
    update claims
    set ciba_block_reason = ${reason}, updated_at = now()
    where id = ${claimId}
  `
}

/**
 * Release the claim. Callers must have already checked CIBA yeses
 * against the pair frozen on this row — not live demo_settings.
 */
export async function approveClaim(claimId: string): Promise<boolean> {
  await ensureBoardRulesSchema()
  const rows = (await sql`
    update claims set status = 'approved', updated_at = now()
    where id = ${claimId}
      and status = 'awaiting_approval'
      and ciba_yes_threshold is not null
    returning id
  `) as { id: string }[]
  return rows.length > 0
}

export async function attachCalendarEvent(
  claimId: string,
  eventId: string,
): Promise<boolean> {
  const rows = (await sql`
    update claims
    set calendar_event_id = ${eventId}, updated_at = now()
    where id = ${claimId} and calendar_event_id is null
    returning id
  `) as { id: string }[]
  return rows.length > 0
}

export async function getLatestSubmittedClaim(): Promise<Claim | null> {
  await ensureBoardRulesSchema()
  const rows = (await sql`
    select * from claims
    where status in ('awaiting_approval', 'approved')
    order by created_at desc
    limit 1
  `) as ClaimRow[]
  return rows[0] ? toClaim(rows[0]) : null
}

export async function hasApproved(claimId: string, approverId: string): Promise<boolean> {
  const rows = (await sql`
    select 1 from claim_approvals
    where claim_id = ${claimId} and approver_id = ${approverId}
    limit 1
  `) as unknown[]
  return rows.length > 0
}

export type ClearedClaim = {
  id: string
  status: ClaimStatus
}

/**
 * Host rehearsal reset. Deletes the in-flight claim(s) so /file-claim
 * starts a new chat and the CIBA lock lifts. `messages`,
 * `ciba_authorizations`, and `claim_approvals` cascade from `claims`.
 *
 * Does not touch demo_joiners, board_picks / board_members,
 * demo_settings, or Token Vault.
 */
export async function clearCurrentClaims(hostUserId: string): Promise<ClearedClaim[]> {
  await ensureBoardRulesSchema()

  const lockRows = (await sql`
    select id, status from claims
    where status = 'awaiting_approval'
       or (status = 'approved' and calendar_event_id is null)
  `) as { id: string; status: ClaimStatus }[]

  const openRows = (await sql`
    select id, status from claims
    where user_id = ${hostUserId} and status <> 'approved'
    order by created_at desc
    limit 1
  `) as { id: string; status: ClaimStatus }[]

  const byId = new Map<string, ClaimStatus>()
  for (const row of [...lockRows, ...openRows]) {
    byId.set(row.id, row.status)
  }

  const deleted: ClearedClaim[] = []
  for (const id of byId.keys()) {
    const rows = (await sql`
      delete from claims where id = ${id} returning id, status
    `) as { id: string; status: ClaimStatus }[]
    if (rows[0]) deleted.push({ id: rows[0].id, status: rows[0].status })
  }
  return deleted
}
