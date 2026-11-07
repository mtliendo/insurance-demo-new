import { sanitizeBindingMessage } from '@/lib/binding-message'

/** Auth0 sends email when requested_expiry is 301–259200s. ≤300 is Guardian push. */
export const CIBA_EMAIL_MIN_EXPIRY_SECONDS = 301
/** Board CIBA. Leave this at 600 — cancel uses `CIBA_CANCEL_EXPIRY_SECONDS`. */
export const CIBA_EMAIL_EXPIRY_SECONDS = 600
/** ~5 minutes, just above 300 so Auth0 uses email, not Guardian. */
export const CIBA_CANCEL_EXPIRY_SECONDS = 301

function emailChannelExpirySeconds(requested?: number): number {
  const n = requested ?? CIBA_EMAIL_EXPIRY_SECONDS
  if (!Number.isFinite(n)) return CIBA_EMAIL_EXPIRY_SECONDS
  return Math.max(CIBA_EMAIL_MIN_EXPIRY_SECONDS, Math.floor(n))
}

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
 * requested_expiry >300 selects the **email** channel (≤300 is Guardian).
 * Board keeps 600. cancel_claim uses `CIBA_CANCEL_EXPIRY_SECONDS` (301).
 * Then poll /oauth/token with grant_type urn:openid:params:grant-type:ciba.
 */
export async function startCiba(
  sub: string,
  bindingMessage: string,
  options?: { requestedExpirySeconds?: number },
) {
  const cleaned = sanitizeBindingMessage(bindingMessage)
  const requestedExpiry = emailChannelExpirySeconds(options?.requestedExpirySeconds)
  const body = new URLSearchParams({
    client_id: requireEnv('AUTH0_CLIENT_ID'),
    client_secret: requireEnv('AUTH0_CLIENT_SECRET'),
    scope: 'openid',
    binding_message: cleaned,
    requested_expiry: String(requestedExpiry),
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
    expiresIn: Number(json.expires_in ?? requestedExpiry),
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
      reason: error,
      error: json.error_description || error,
    }
  }
  return {
    status: 'error' as const,
    error: json.error_description || error || 'token poll failed',
  }
}
