import 'server-only'
import {
  DEFAULT_BOARD_SIZE,
  DEFAULT_CIBA_YES_THRESHOLD,
} from '@/lib/types'

/**
 * Stage board is 6 seats / 3 CIBA yeses. Rehearsal (Focus, no six Auth0
 * accounts) is BOARD_SIZE=2 and CIBA_YES_THRESHOLD=2. Do not hardcode the
 * stage demo to 2 — unset env keeps the defaults.
 */
function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return fallback
  return n
}

export function getBoardSize(): number {
  return parsePositiveInt(process.env.BOARD_SIZE, DEFAULT_BOARD_SIZE)
}

export function getCibaYesThreshold(): number {
  const size = getBoardSize()
  const threshold = parsePositiveInt(
    process.env.CIBA_YES_THRESHOLD,
    DEFAULT_CIBA_YES_THRESHOLD,
  )
  return Math.min(threshold, size)
}

export function isFullBoard(length: number): boolean {
  return length === getBoardSize()
}
