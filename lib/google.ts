import { auth0 } from '@/lib/auth0'

export const GOOGLE_CONNECTION = 'google-oauth2'

export async function isGoogleConnected(): Promise<boolean> {
  try {
    await auth0.getAccessTokenForConnection({ connection: GOOGLE_CONNECTION })
    return true
  } catch {
    return false
  }
}

export async function getGoogleAccessToken(): Promise<string | null> {
  try {
    const { token } = await auth0.getAccessTokenForConnection({
      connection: GOOGLE_CONNECTION,
    })
    return token ?? null
  } catch {
    return null
  }
}
