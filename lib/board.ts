import { sql } from '@/lib/db'
import { isHostIdentity } from '@/lib/host'
import { BOARD_SIZE } from '@/lib/types'

export type Joiner = {
  sub: string
  email: string
  name: string
  emailVerified: boolean
  pinned: boolean
  joinedAt: string
  lastSeenAt: string
}

export type BoardMember = {
  sub: string
  email: string
  name: string
}

type JoinerRow = {
  sub: string
  email: string
  name: string
  email_verified: boolean
  pinned: boolean
  joined_at: Date | string
  last_seen_at: Date | string
}

function toJoiner(row: JoinerRow): Joiner {
  return {
    sub: row.sub,
    email: row.email,
    name: row.name,
    emailVerified: row.email_verified,
    pinned: row.pinned,
    joinedAt: new Date(row.joined_at).toISOString(),
    lastSeenAt: new Date(row.last_seen_at).toISOString(),
  }
}

export async function upsertJoiner(input: {
  sub: string
  email: string
  name: string
  emailVerified: boolean
}): Promise<Joiner> {
  const rows = (await sql`
    insert into demo_joiners (sub, email, name, email_verified, last_seen_at)
    values (${input.sub}, ${input.email}, ${input.name}, ${input.emailVerified}, now())
    on conflict (sub) do update set
      email = excluded.email,
      name = excluded.name,
      email_verified = excluded.email_verified,
      last_seen_at = now()
    returning *
  `) as JoinerRow[]
  return toJoiner(rows[0])
}

export async function listJoiners(): Promise<Joiner[]> {
  const rows = (await sql`
    select * from demo_joiners
    order by pinned desc, joined_at
  `) as JoinerRow[]
  return rows.map(toJoiner)
}

export async function getJoiner(sub: string): Promise<Joiner | null> {
  const rows = (await sql`
    select * from demo_joiners where sub = ${sub}
  `) as JoinerRow[]
  return rows[0] ? toJoiner(rows[0]) : null
}

export async function setJoinerPinned(sub: string, pinned: boolean): Promise<Joiner | null> {
  const rows = (await sql`
    update demo_joiners set pinned = ${pinned}
    where sub = ${sub}
    returning *
  `) as JoinerRow[]
  return rows[0] ? toJoiner(rows[0]) : null
}

export async function getLatestPickId(): Promise<string | null> {
  const rows = (await sql`
    select id from board_picks
    order by picked_at desc
    limit 1
  `) as { id: string }[]
  return rows[0]?.id ?? null
}

export async function getCurrentBoard(): Promise<BoardMember[]> {
  const pickId = await getLatestPickId()
  if (!pickId) return []
  const rows = (await sql`
    select sub, email, name from board_members
    where pick_id = ${pickId}
    order by name
  `) as BoardMember[]
  return rows
}

export async function isOnCurrentBoard(sub: string): Promise<boolean> {
  const pickId = await getLatestPickId()
  if (!pickId) return false
  const rows = (await sql`
    select 1 from board_members
    where pick_id = ${pickId} and sub = ${sub}
    limit 1
  `) as unknown[]
  return rows.length > 0
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Randomly select up to 6 verified joiners. Pinned rows (planted friends)
 * are always included first; the rest of the seats are shuffled in.
 * The host is never seated — they file the claim, they don't CIBA it.
 */
export function selectBoard(joiners: Joiner[]): Joiner[] {
  const eligible = joiners.filter(
    (j) => j.emailVerified && !isHostIdentity(j.sub, j.email),
  )
  const pinned = eligible.filter((j) => j.pinned)
  const rest = shuffle(eligible.filter((j) => !j.pinned))
  return [...pinned, ...rest].slice(0, BOARD_SIZE)
}

export async function pickBoard(pickedBy: string): Promise<BoardMember[]> {
  const selected = selectBoard(await listJoiners())
  if (selected.length === 0) {
    throw new Error('No verified joiners to seat. The room has to log in first.')
  }

  const pickRows = (await sql`
    insert into board_picks (picked_by)
    values (${pickedBy})
    returning id
  `) as { id: string }[]
  const pickId = pickRows[0].id

  for (const member of selected) {
    await sql`
      insert into board_members (pick_id, sub, email, name)
      values (${pickId}, ${member.sub}, ${member.email}, ${member.name})
    `
  }

  return selected.map(({ sub, email, name }) => ({ sub, email, name }))
}
