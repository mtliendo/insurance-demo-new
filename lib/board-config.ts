import 'server-only'
import { sql } from '@/lib/db'
import {
  DEFAULT_BOARD_SIZE,
  DEFAULT_CIBA_YES_THRESHOLD,
  MAX_BOARD_SIZE,
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
 */
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
  const rows = (await sql`
    select board_size, yes_threshold from demo_settings
    where singleton = true
    limit 1
  `) as SettingsRow[]
  const row = rows[0]
  if (!row) return DEFAULTS
  try {
    return validateBoardSettings(row.board_size, row.yes_threshold)
  } catch {
    return DEFAULTS
  }
}

export async function saveBoardSettings(input: {
  boardSize: number
  yesThreshold: number
  updatedBy: string
}): Promise<BoardSettings> {
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
