import 'server-only'
import {
  DEFAULT_BOARD_SIZE,
  DEFAULT_CIBA_YES_THRESHOLD,
} from '@/lib/types'

export type BoardSettings = {
  boardSize: number
  yesThreshold: number
}

/**
 * Stage defaults are 6 seats / 3 CIBA yeses. Rehearsal is
 * BOARD_SIZE=2 and CIBA_YES_THRESHOLD=2 in .env.local or Vercel —
 * not a code flag, and not hardcoded to 2. Read on every call so a
 * restart (or a Vercel env change) is enough.
 */
function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return fallback
  return n
}

export function getBoardSize(): number {
  return parsePositiveInt(process.env['BOARD_SIZE'], DEFAULT_BOARD_SIZE)
}

export function getCibaYesThreshold(): number {
  const size = getBoardSize()
  const threshold = parsePositiveInt(
    process.env['CIBA_YES_THRESHOLD'],
    DEFAULT_CIBA_YES_THRESHOLD,
  )
  return Math.min(threshold, size)
}

export function getBoardSettings(): BoardSettings {
  return {
    boardSize: getBoardSize(),
    yesThreshold: getCibaYesThreshold(),
  }
}

export function isFullBoard(length: number, boardSize = getBoardSize()): boolean {
  return length === boardSize
}
