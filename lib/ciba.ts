import { sanitizeBindingMessage } from '@/lib/binding-message'
import { CIBA_INTERVAL_FLOOR, floorInterval, nextPollInterval } from '@/lib/ciba-interval'

/** Auth0 sends email when requested_expiry is 301–259200s. ≤300 is Guardian push. */
export const CIBA_EMAIL_EXPIRY_SECONDS = 600

function domain() {
  const raw = process.env.AUTH0_DOMAIN
  if (!raw) throw new Error('AUTH0_DOMAIN is not set')
  return raw.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function issuer() {
  return `https://${domain()}/`
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

/**
 * Client-initiated backchannel auth over email. Copied from the working
 * loop in https://github.com/mtliendo/ciba-email — not @auth0/ai.
 *
 * POST /bc-authorize with login_hint iss_sub:
 *   iss = https://${AUTH0_DOMAIN}/
 *   sub = the authorizing user's Auth0 sub (current session for cancel)
 * requested_expiry=600 selects the **email** channel (>300; ≤300 is Guardian).
 * Then poll /oauth/token with grant_type urn:openid:params:grant-type:ciba.
 */
export async function startCiba(sub: string, bindingMessage: string) {
  const cleaned = sanitizeBindingMessage(bindingMessage)
  const body = new URLSearchParams({
    client_id: requireEnv('AUTH0_CLIENT_ID'),
    client_secret: requireEnv('AUTH0_CLIENT_SECRET'),
    scope: 'openid',
    binding_message: cleaned,
    requested_expiry: String(CIBA_EMAIL_EXPIRY_SECONDS),
    login_hint: JSON.stringify({
      format: 'iss_sub',
      iss: issuer(),
      sub,
    }),
  })

  const res = await fetch(`https://${domain()}/bc-authorize`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = (await res.json()) as {
    auth_req_id?: string
    interval?: number
    expires_in?: number
    error?: string
    error_description?: string
  }
  if (!res.ok || !json.auth_req_id) {
    throw new Error(json.error_description || json.error || 'bc-authorize failed')
  }
  return {
    authReqId: json.auth_req_id,
    interval: Number(json.interval ?? 5),
    expiresIn: Number(json.expires_in ?? CIBA_EMAIL_EXPIRY_SECONDS),
    bindingMessage: cleaned,
  }
}

export async function pollCiba(authReqId: string) {
  const body = new URLSearchParams({
    grant_type: 'urn:openid:params:grant-type:ciba',
    client_id: requireEnv('AUTH0_CLIENT_ID'),
    client_secret: requireEnv('AUTH0_CLIENT_SECRET'),
    auth_req_id: authReqId,
  })

  const res = await fetch(`https://${domain()}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = (await res.json()) as {
    access_token?: string
    error?: string
    error_description?: string
    interval?: number
  }

  if (res.ok && json.access_token) {
    return { status: 'approved' as const }
  }

  const error = json.error
  const interval = json.interval != null ? Number(json.interval) : undefined
  if (error === 'authorization_pending') {
    return { status: 'pending' as const, interval, slowDown: false as const }
  }
  if (error === 'slow_down') {
    return { status: 'pending' as const, interval, slowDown: true as const }
  }
  if (error === 'access_denied' || error === 'expired_token') {
    return {
      status: 'denied' as const,
      error: json.error_description || error,
    }
  }
  return {
    status: 'error' as const,
    error: json.error_description || error || 'token poll failed',
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** Default how long `cancel_claim` waits for the policyholder's CIBA email. */
const DEFAULT_CANCEL_WAIT_MS = 70_000

/**
 * Optional `CIBA_CANCEL_WAIT_MS` (milliseconds). Floor 10s, cap 240s.
 * Keep this under the chat route `maxDuration` so the tool can finish.
 */
export function cancelCibaWaitMs(): number {
  const raw = process.env.CIBA_CANCEL_WAIT_MS
  if (!raw?.trim()) return DEFAULT_CANCEL_WAIT_MS
  const n = Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_CANCEL_WAIT_MS
  return Math.min(240_000, Math.max(10_000, n))
}

export type CibaWaitResult =
  | { status: 'approved' }
  | { status: 'denied'; error?: string }
  | { status: 'error'; error: string }
  | { status: 'timeout' }

/**
 * Poll `/oauth/token` until CIBA is approved, denied, errors, or the
 * wait budget runs out. Honors Auth0's interval (floor 5s) and
 * `slow_down`. Used by `cancel_claim` so the tool itself waits — we do
 * **not** write `ciba_authorizations` (those rows are the board grant).
 */
export async function waitForCiba(
  authReqId: string,
  options?: { timeoutMs?: number; intervalSec?: number },
): Promise<CibaWaitResult> {
  const timeoutMs = options?.timeoutMs ?? cancelCibaWaitMs()
  const deadline = Date.now() + timeoutMs
  let intervalSec = floorInterval(options?.intervalSec ?? CIBA_INTERVAL_FLOOR)

  while (Date.now() < deadline) {
    const waitMs = Math.min(intervalSec * 1000, Math.max(0, deadline - Date.now()))
    if (waitMs > 0) await sleep(waitMs)
    if (Date.now() >= deadline) break

    const result = await pollCiba(authReqId)
    if (result.status === 'approved') return { status: 'approved' }
    if (result.status === 'denied') return { status: 'denied', error: result.error }
    if (result.status === 'error') {
      return { status: 'error', error: result.error || 'token poll failed' }
    }
    intervalSec = nextPollInterval(intervalSec, result.interval, result.slowDown)
  }

  return { status: 'timeout' }
}
