const BINDING_ALLOWED = /[^A-Za-z0-9+\-._.,:#]/g

/** Auth0 CIBA binding_message: max 64, charset A-Za-z0-9+-_.,:# , no spaces. */
export function sanitizeBindingInput(raw: string) {
  return raw.replace(/\s+/g, '-').replace(BINDING_ALLOWED, '').slice(0, 64)
}

export function sanitizeBindingMessage(raw: string) {
  return sanitizeBindingInput(raw).replace(/^-+|-+$/g, '') || 'Hulk-smash-claim'
}

export function bindingMessageForClaim(claimId: string) {
  const short = claimId.replace(/-/g, '').slice(0, 8)
  return sanitizeBindingMessage(`Hulk-smash-claim-${short}`)
}
