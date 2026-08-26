import { sql } from '@/lib/db'
import { CIBA_INTERVAL_FLOOR, isPollDue } from '@/lib/ciba-interval'
import type { CibaBoardMember, CibaStatus } from '@/lib/types'
import { CIBA_REQUIRED_APPROVALS } from '@/lib/types'

export type CibaRow = {
  id: string
  claim_id: string
  auth_req_id: string
  sub: string
  email: string
  name: string
  status: CibaStatus
  binding_message: string
  interval_sec: number
  expires_at: Date | string | null
  error: string | null
  last_polled_at: Date | string | null
}

export function toCibaMember(row: CibaRow): CibaBoardMember {
  return {
    sub: row.sub,
    email: row.email,
    name: row.name,
    status: row.status,
    bindingMessage: row.binding_message,
    error: row.error,
  }
}

export async function listCibaForClaim(claimId: string): Promise<CibaRow[]> {
  return (await sql`
    select * from ciba_authorizations
    where claim_id = ${claimId}
    order by name
  `) as CibaRow[]
}

export async function getCibaForSub(
  claimId: string,
  sub: string,
): Promise<CibaRow | null> {
  const rows = (await sql`
    select * from ciba_authorizations
    where claim_id = ${claimId} and sub = ${sub}
    limit 1
  `) as CibaRow[]
  return rows[0] ?? null
}

export async function hasCibaStarted(claimId: string): Promise<boolean> {
  const rows = (await sql`
    select 1 from ciba_authorizations
    where claim_id = ${claimId}
    limit 1
  `) as unknown[]
  return rows.length > 0
}

export async function hasLiveCiba(): Promise<boolean> {
  const rows = (await sql`
    select 1 from ciba_authorizations c
    join claims cl on cl.id = c.claim_id
    where cl.status = 'awaiting_approval'
    limit 1
  `) as unknown[]
  return rows.length > 0
}

export async function insertCibaAuthorization(input: {
  claimId: string
  authReqId: string
  sub: string
  email: string
  name: string
  status: CibaStatus
  bindingMessage: string
  intervalSec: number
  expiresAt: Date | null
  error?: string | null
}): Promise<void> {
  await sql`
    insert into ciba_authorizations (
      claim_id, auth_req_id, sub, email, name, status,
      binding_message, interval_sec, expires_at, error, last_polled_at
    )
    values (
      ${input.claimId}, ${input.authReqId}, ${input.sub}, ${input.email},
      ${input.name}, ${input.status}, ${input.bindingMessage},
      ${input.intervalSec}, ${input.expiresAt}, ${input.error ?? null}, now()
    )
    on conflict (claim_id, sub) do nothing
  `
}

export async function updateCibaStatus(
  authReqId: string,
  status: CibaStatus,
  extra?: { intervalSec?: number; error?: string | null },
): Promise<void> {
  await sql`
    update ciba_authorizations set
      status = ${status},
      interval_sec = coalesce(${extra?.intervalSec ?? null}, interval_sec),
      error = ${extra?.error ?? null},
      updated_at = now()
    where auth_req_id = ${authReqId} and status = 'pending'
  `
}

export function duePendingCiba(rows: CibaRow[]): CibaRow[] {
  return rows.filter(
    (row) => row.status === 'pending' && isPollDue(row.last_polled_at, row.interval_sec),
  )
}

/**
 * Claim the next Auth0 poll slot. Returning empty means another request
 * already ticked this auth_req_id inside the stored interval.
 */
export async function claimCibaPollSlot(authReqId: string): Promise<CibaRow | null> {
  const rows = (await sql`
    update ciba_authorizations
    set last_polled_at = now(), updated_at = now()
    where auth_req_id = ${authReqId}
      and status = 'pending'
      and (
        last_polled_at is null
        or last_polled_at + (greatest(interval_sec, ${CIBA_INTERVAL_FLOOR}) * interval '1 second') <= now()
      )
    returning *
  `) as CibaRow[]
  return rows[0] ?? null
}

export async function countCibaApproved(claimId: string): Promise<number> {
  const rows = (await sql`
    select count(*)::int as count
    from ciba_authorizations
    where claim_id = ${claimId} and status = 'approved'
  `) as { count: number }[]
  return rows[0]?.count ?? 0
}

export function cibaMetThreshold(approvedCount: number): boolean {
  return approvedCount >= CIBA_REQUIRED_APPROVALS
}
