/**
 * Audience CIBA board (QR, /join, seating, board emails). Default **off**
 * so the Iowa Code Camp talk is Token Vault + cancel-claim CIBA only.
 * Set NEXT_PUBLIC_DEMO_BOARD_ENABLED=1 to bring the board UI back.
 */
export function isBoardDemoEnabled(): boolean {
  const raw =
    process.env.NEXT_PUBLIC_DEMO_BOARD_ENABLED ?? process.env.DEMO_BOARD_ENABLED
  const v = raw?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}
