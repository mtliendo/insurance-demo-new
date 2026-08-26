type SessionUser = {
  sub?: string
  email?: string | null
}

/**
 * Focus is the signed-in demo host. Set DEMO_HOST_EMAIL (and optionally
 * DEMO_HOST_SUB) so audience members who also log in cannot pick the board
 * or connect Google. Unset, any signed-in user can operate — useful locally.
 */
export function isDemoHost(user: SessionUser): boolean {
  const hostEmail = process.env.DEMO_HOST_EMAIL?.trim().toLowerCase()
  const hostSub = process.env.DEMO_HOST_SUB?.trim()
  if (!hostEmail && !hostSub) return true
  if (hostEmail && user.email?.toLowerCase() === hostEmail) return true
  if (hostSub && user.sub === hostSub) return true
  return false
}

export function hostSub(): string | null {
  return process.env.DEMO_HOST_SUB?.trim() || null
}

export function hostEmail(): string | null {
  return process.env.DEMO_HOST_EMAIL?.trim().toLowerCase() || null
}

export function isHostIdentity(sub: string, email?: string | null): boolean {
  const configuredSub = hostSub()
  const configuredEmail = hostEmail()
  if (configuredSub && sub === configuredSub) return true
  if (configuredEmail && email?.toLowerCase() === configuredEmail) return true
  return false
}
