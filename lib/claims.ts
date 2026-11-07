import { clearSeatedBoard } from '@/lib/board'
import { ensureBoardRulesSchema } from '@/lib/board-config'
import { CIBA_INTERVAL_FLOOR } from '@/lib/ciba-interval'
import { sql } from '@/lib/db'
import type {
  CancelCibaStatus,
  ChatMessage,
  CibaBlockReason,
  Claim,
  ClaimStatus,
} from '@/lib/types'

let statusSchemaReady = false

/** Allow `cancelled` on existing DBs whose check constraint predates this status. */
async function ensureClaimStatusSchema(): Promise<void> {
  if (statusSchemaReady) return
  try {
    await sql`alter table claims drop constraint if exists claims_status_check`
    await sql`
      alter table claims add constraint claims_status_check
        check (status in ('pending','awaiting_approval','approved','denied','cancelled'))
    `
  } catch (error) {
    console.error('Could not update claims status check for cancelled:', error)
  }
  try {
    await sql`alter table claims add column if not exists cancel_ciba_status text`
    await sql`alter table claims add column if not exists cancel_ciba_auth_req_id text`
    await sql`alter table claims add column if not exists cancel_ciba_interval_sec integer`
    await sql`alter table claims add column if not exists cancel_ciba_expires_at timestamptz`
    await sql`alter table claims add column if not exists cancel_ciba_last_polled_at timestamptz`
    statusSchemaReady = true
  } catch (error) {
    console.error('Could not add cancel_ciba_status column:', error)
  }
}

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
  cancel_ciba_status: string | null
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
    cancelCibaStatus:
      row.cancel_ciba_status === 'pending' ||
      row.cancel_ciba_status === 'approved' ||
      row.cancel_ciba_status === 'denied'
        ? row.cancel_ciba_status
        : null,
  }
}

export async function createClaim(userId: string, policyId: string): Promise<Claim> {
  await ensureBoardRulesSchema()
  await ensureClaimStatusSchema()
  const rows = (await sql`
    insert into claims (user_id, policy_id)
    values (${userId}, ${policyId})
    returning *
  `) as ClaimRow[]
  return toClaim(rows[0])
}

export async function getClaim(id: string): Promise<Claim | null> {
  await ensureBoardRulesSchema()
  await ensureClaimStatusSchema()
  const rows = (await sql`select * from claims where id = ${id}`) as ClaimRow[]
  return rows[0] ? toClaim(rows[0]) : null
}

/** Most recent claim for a user — lets the file-claim page resume instead of restarting. */
export async function getLatestClaimForUser(userId: string): Promise<Claim | null> {
  await ensureBoardRulesSchema()
  await ensureClaimStatusSchema()
  const rows = (await sql`
    select * from claims
    where user_id = ${userId} and status not in ('approved', 'cancelled')
    order by created_at desc
    limit 1
  `) as ClaimRow[]
  return rows[0] ? toClaim(rows[0]) : null
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

export async function setCancelCibaStatus(
  claimId: string,
  status: CancelCibaStatus,
): Promise<void> {
  await ensureClaimStatusSchema()
  await sql`
    update claims set cancel_ciba_status = ${status}, updated_at = now()
    where id = ${claimId}
  `
}

/** Persist the policyholder cancel CIBA so GET /api/claims/[id] can poll Auth0. */
export async function saveCancelCibaGrant(
  claimId: string,
  grant: { authReqId: string; intervalSec: number; expiresAt: Date },
): Promise<void> {
  await ensureClaimStatusSchema()
  await sql`
    update claims set
      cancel_ciba_auth_req_id = ${grant.authReqId},
      cancel_ciba_interval_sec = ${grant.intervalSec},
      cancel_ciba_expires_at = ${grant.expiresAt},
      cancel_ciba_last_polled_at = now(),
      updated_at = now()
    where id = ${claimId} and cancel_ciba_status = 'pending'
  `
}

/**
 * Claim the next Auth0 poll slot for cancel CIBA. Empty means another
 * request already ticked this claim inside the stored interval.
 */
export async function claimCancelCibaPollSlot(
  claimId: string,
): Promise<{ authReqId: string; intervalSec: number } | null> {
  await ensureClaimStatusSchema()
  const rows = (await sql`
    update claims
    set cancel_ciba_last_polled_at = now(), updated_at = now()
    where id = ${claimId}
      and cancel_ciba_status = 'pending'
      and cancel_ciba_auth_req_id is not null
      and (
        cancel_ciba_last_polled_at is null
        or cancel_ciba_last_polled_at
          + (greatest(coalesce(cancel_ciba_interval_sec, ${CIBA_INTERVAL_FLOOR}), ${CIBA_INTERVAL_FLOOR})
            * interval '1 second')
          <= now()
      )
    returning cancel_ciba_auth_req_id, cancel_ciba_interval_sec
  `) as { cancel_ciba_auth_req_id: string; cancel_ciba_interval_sec: number | null }[]
  const row = rows[0]
  if (!row?.cancel_ciba_auth_req_id) return null
  return {
    authReqId: row.cancel_ciba_auth_req_id,
    intervalSec: row.cancel_ciba_interval_sec ?? CIBA_INTERVAL_FLOOR,
  }
}

export async function updateCancelCibaInterval(
  claimId: string,
  intervalSec: number,
): Promise<void> {
  await sql`
    update claims
    set cancel_ciba_interval_sec = ${intervalSec}, updated_at = now()
    where id = ${claimId} and cancel_ciba_status = 'pending'
  `
}

/** Flip pending → approved/denied once. Callers then cancel the claim or not. */
export async function completeCancelCiba(
  claimId: string,
  status: Exclude<CancelCibaStatus, 'pending'>,
): Promise<boolean> {
  await ensureClaimStatusSchema()
  const rows = (await sql`
    update claims set cancel_ciba_status = ${status}, updated_at = now()
    where id = ${claimId} and cancel_ciba_status = 'pending'
    returning id
  `) as { id: string }[]
  return rows.length > 0
}

/**
 * Approve without a seated board — Token Vault talk path. Does not
 * require ciba_yes_threshold.
 */
export async function approveClaimWithoutBoard(claimId: string): Promise<boolean> {
  await ensureBoardRulesSchema()
  await ensureClaimStatusSchema()
  const rows = (await sql`
    update claims set status = 'approved', updated_at = now()
    where id = ${claimId} and status in ('pending', 'awaiting_approval')
    returning id
  `) as { id: string }[]
  return rows.length > 0
}

/**
 * Backs the cancel_claim tool after CIBA approval. Leaves board CIBA
 * rows alone — those only release `awaiting_approval` claims.
 */
export async function cancelClaim(claimId: string): Promise<boolean> {
  await ensureBoardRulesSchema()
  await ensureClaimStatusSchema()
  const rows = (await sql`
    update claims set status = 'cancelled', updated_at = now()
    where id = ${claimId} and status <> 'cancelled'
    returning id
  `) as { id: string }[]
  return rows.length > 0
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
  await ensureClaimStatusSchema()
  const rows = (await sql`
    select * from claims
    where status in ('awaiting_approval', 'approved')
    order by created_at desc
    limit 1
  `) as ClaimRow[]
  return rows[0] ? toClaim(rows[0]) : null
}

export type ClearedClaim = {
  id: string
  status: ClaimStatus
}

/**
 * Host rehearsal reset. Deletes the claim the /host projector shows —
 * every `awaiting_approval` or `approved` row, including approved +
 * `calendar_event_id` — plus the host's latest unapproved chat, and
 * the seated board (`board_picks` / `board_members`). Leftover host
 * seats are why CIBA mailed the operator. `messages`,
 * `ciba_authorizations`, and leftover `claim_approvals` cascade from
 * `claims`. Does not delete the Google Calendar event.
 *
 * Does not touch demo_joiners, demo_settings, Token Vault, or Auth0 users.
 */
export async function clearCurrentClaims(hostUserId: string): Promise<ClearedClaim[]> {
  await ensureBoardRulesSchema()
  await ensureClaimStatusSchema()

  // Projector uses getLatestSubmittedClaim (latest awaiting_approval or
  // approved). Must delete approved+calendar rows too, or /host keeps
  // CALENDAR WRITTEN / CIBA ticks after chat is cleared.
  const projectorRows = (await sql`
    select id, status from claims
    where status in ('awaiting_approval', 'approved')
  `) as { id: string; status: ClaimStatus }[]

  const openRows = (await sql`
    select id, status from claims
    where user_id = ${hostUserId} and status <> 'approved'
    order by created_at desc
    limit 1
  `) as { id: string; status: ClaimStatus }[]

  const byId = new Map<string, ClaimStatus>()
  for (const row of [...projectorRows, ...openRows]) {
    byId.set(row.id, row.status)
  }

  const deleted: ClearedClaim[] = []
  for (const id of byId.keys()) {
    const rows = (await sql`
      delete from claims where id = ${id} returning id, status
    `) as { id: string; status: ClaimStatus }[]
    if (rows[0]) deleted.push({ id: rows[0].id, status: rows[0].status })
  }

  await clearSeatedBoard()
  return deleted
}
