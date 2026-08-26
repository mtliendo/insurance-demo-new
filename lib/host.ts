type SessionUser = {
  sub?: string
  email?: string | null
}

export function hostSub(): string | null {
  return process.env.DEMO_HOST_SUB?.trim() || null
}

export function hostEmail(): string | null {
  return process.env.DEMO_HOST_EMAIL?.trim().toLowerCase() || null
}

/** Stage lock: someone must be named. Unset is not "everyone is host." */
export function hostGateConfigured(): boolean {
  return Boolean(hostEmail() || hostSub())
}

export function hostGateError(): string | null {
  if (hostGateConfigured()) return null
  return 'DEMO_HOST_EMAIL or DEMO_HOST_SUB must be set. Refusing to treat every login as host.'
}

/**
 * Focus is the signed-in demo host. Fail closed if neither env is set.
 * Audience members who also log in cannot pick the board or connect Google.
 */
export function isDemoHost(user: SessionUser): boolean {
  if (!hostGateConfigured()) return false
  const email = hostEmail()
  const sub = hostSub()
  if (email && user.email?.toLowerCase() === email) return true
  if (sub && user.sub === sub) return true
  return false
}

export function isHostIdentity(sub: string, email?: string | null): boolean {
  return isDemoHost({ sub, email })
}

/**
 * Token Vault tokens belong to the current session. Only write calendar
 * when that session is the configured host — prefer DEMO_HOST_SUB so we
 * never mint an event from a joiner who happened to be polling.
 */
export function canWriteHostCalendar(user: SessionUser): boolean {
  if (!isDemoHost(user)) return false
  const configuredSub = hostSub()
  if (configuredSub) return user.sub === configuredSub
  return true
}
