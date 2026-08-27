import 'server-only'
import { sql } from '@/lib/db'
import {
  DEFAULT_BOARD_SIZE,
  DEFAULT_CIBA_YES_THRESHOLD,
  MAX_BOARD_SIZE,
  type Claim,
} from '@/lib/types'

export type BoardSettings = {
  boardSize: number
  yesThreshold: number
}

const DEFAULTS: BoardSettings = {
  boardSize: DEFAULT_BOARD_SIZE,
  yesThreshold: DEFAULT_CIBA_YES_THRESHOLD,
}

type SettingsRow = {
  board_size: number
  yes_threshold: number
}

/**
 * Stage board is 6 seats / 3 CIBA yeses. Focus sets 2 / 2 on /host for
 * rehearsal. Values live in demo_settings — not env, not a code flag.
 * A claim in the CIBA-or-calendar-catch-up window uses the pair frozen
 * on the claim row at CIBA start, not this live row.
 */
let schemaReady = false

export async function ensureBoardRulesSchema(): Promise<void> {
  if (schemaReady) return
  await sql`
    create table if not exists demo_settings (
      singleton boolean primary key default true check (singleton),
      board_size integer not null default 6
        check (board_size >= 1 and board_size <= 24),
      yes_threshold integer not null default 3
        check (yes_threshold >= 1 and yes_threshold <= board_size),
      updated_at timestamptz not null default now(),
      updated_by text
    )
  `
  await sql`
    insert into demo_settings (singleton, board_size, yes_threshold)
    values (true, 6, 3)
    on conflict (singleton) do nothing
  `
  await sql`alter table claims add column if not exists ciba_board_size integer`
  await sql`alter table claims add column if not exists ciba_yes_threshold integer`
  schemaReady = true
}

export function validateBoardSettings(
  boardSize: number,
  yesThreshold: number,
): BoardSettings {
  if (!Number.isInteger(boardSize) || boardSize < 1 || boardSize > MAX_BOARD_SIZE) {
    throw new Error(`Board size must be an integer from 1 to ${MAX_BOARD_SIZE}.`)
  }
  if (!Number.isInteger(yesThreshold) || yesThreshold < 1) {
    throw new Error('Yes threshold must be an integer of at least 1.')
  }
  if (yesThreshold > boardSize) {
    throw new Error(
      `Yes threshold (${yesThreshold}) cannot exceed board size (${boardSize}).`,
    )
  }
  return { boardSize, yesThreshold }
}

export async function getBoardSettings(): Promise<BoardSettings> {
  await ensureBoardRulesSchema()
  const rows = (await sql`
    select board_size, yes_threshold from demo_settings
    where singleton = true
    limit 1
  `) as SettingsRow[]
  const row = rows[0]
  if (!row) return DEFAULTS
  try {
    return validateBoardSettings(Number(row.board_size), Number(row.yes_threshold))
  } catch {
    return DEFAULTS
  }
}

export async function saveBoardSettings(input: {
  boardSize: number
  yesThreshold: number
  updatedBy: string
}): Promise<BoardSettings> {
  await ensureBoardRulesSchema()
  const next = validateBoardSettings(input.boardSize, input.yesThreshold)
  await sql`
    insert into demo_settings (singleton, board_size, yes_threshold, updated_by, updated_at)
    values (true, ${next.boardSize}, ${next.yesThreshold}, ${input.updatedBy}, now())
    on conflict (singleton) do update set
      board_size = excluded.board_size,
      yes_threshold = excluded.yes_threshold,
      updated_by = excluded.updated_by,
      updated_at = now()
  `
  return next
}

export function isFullBoard(length: number, boardSize: number): boolean {
  return length === boardSize
}

export function frozenBoardRules(claim: Claim): BoardSettings | null {
  if (claim.cibaBoardSize == null || claim.cibaYesThreshold == null) return null
  try {
    return validateBoardSettings(claim.cibaBoardSize, claim.cibaYesThreshold)
  } catch {
    return null
  }
}

export async function boardRulesForClaim(claim: Claim): Promise<BoardSettings> {
  return frozenBoardRules(claim) ?? (await getBoardSettings())
}

/**
 * Stamp the live pair onto the claim once, at CIBA start. Later /host
 * saves must not change the grant or the calendar-write threshold.
 */
export async function freezeCibaBoardRules(
  claimId: string,
  settings: BoardSettings,
): Promise<BoardSettings> {
  await ensureBoardRulesSchema()
  const next = validateBoardSettings(settings.boardSize, settings.yesThreshold)
  const rows = (await sql`
    update claims
    set
      ciba_board_size = coalesce(ciba_board_size, ${next.boardSize}),
      ciba_yes_threshold = coalesce(ciba_yes_threshold, ${next.yesThreshold}),
      updated_at = now()
    where id = ${claimId}
    returning ciba_board_size, ciba_yes_threshold
  `) as { ciba_board_size: number; ciba_yes_threshold: number }[]
  const row = rows[0]
  if (!row) throw new Error('Claim not found')
  return {
    boardSize: Number(row.ciba_board_size),
    yesThreshold: Number(row.ciba_yes_threshold),
  }
}

/** awaiting_approval, or approved but the host calendar write has not landed. */
export function isCibaCatchUpWindow(claim: {
  status: string
  calendarEventId: string | null
}): boolean {
  return (
    claim.status === 'awaiting_approval' ||
    (claim.status === 'approved' && !claim.calendarEventId)
  )
}

export async function hasCibaCatchUpLock(): Promise<boolean> {
  await ensureBoardRulesSchema()
  const rows = (await sql`
    select 1 from claims
    where status = 'awaiting_approval'
       or (status = 'approved' and calendar_event_id is null)
    limit 1
  `) as unknown[]
  return rows.length > 0
}
