import { sanitizeBindingMessage } from '@/lib/binding-message'

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
 * Per board member: POST /bc-authorize with login_hint iss_sub (that
 * member's sub), requested_expiry=600, binding_message. Then poll
 * /oauth/token with grant_type urn:openid:params:grant-type:ciba.
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
  if (error === 'authorization_pending') {
    return { status: 'pending' as const, interval: Number(json.interval ?? 5) }
  }
  if (error === 'slow_down') {
    return { status: 'pending' as const, interval: Number(json.interval ?? 10) }
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
