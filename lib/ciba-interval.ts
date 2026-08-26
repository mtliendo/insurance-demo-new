/** Auth0 default CIBA poll interval. Below this we get slow_down on stage. */
export const CIBA_INTERVAL_FLOOR = 5

export function floorInterval(seconds: number | undefined | null): number {
  const n = Number(seconds)
  if (!Number.isFinite(n)) return CIBA_INTERVAL_FLOOR
  return Math.max(CIBA_INTERVAL_FLOOR, Math.floor(n))
}

/**
 * Next wait before /oauth/token. Floor 5s. slow_down is sticky: a later
 * authorization_pending that says 5 must not pull us back down.
 */
export function nextPollInterval(
  stored: number,
  incoming: number | undefined,
  slowDown: boolean,
): number {
  const current = floorInterval(stored)
  if (slowDown) {
    const bumped = incoming != null ? floorInterval(incoming) : current + CIBA_INTERVAL_FLOOR
    return Math.max(current, bumped)
  }
  if (incoming == null) return current
  return Math.max(current, floorInterval(incoming))
}

export function isPollDue(lastPolledAt: Date | string | null | undefined, intervalSec: number): boolean {
  const intervalMs = floorInterval(intervalSec) * 1000
  if (!lastPolledAt) return true
  const last = new Date(lastPolledAt).getTime()
  if (!Number.isFinite(last)) return true
  return Date.now() >= last + intervalMs
}
