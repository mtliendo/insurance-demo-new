export const GOOGLE_CONNECTION = 'google-oauth2'
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'

/** Host-only Token Vault connect. Calendar scope lives here, not on login. */
export function hostConnectAccountHref(returnTo = '/settings'): string {
  const params = new URLSearchParams({
    connection: GOOGLE_CONNECTION,
    returnTo,
    scopes: GOOGLE_CALENDAR_SCOPE,
  })
  return `/auth/connect?${params.toString()}`
}
