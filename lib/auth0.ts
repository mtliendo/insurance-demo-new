import { Auth0Client } from '@auth0/nextjs-auth0/server'
import { NextResponse } from 'next/server'

/** Audience Universal Login. No calendar, no offline_access — host-only connect. */
export const LOGIN_SCOPES = 'openid profile email'

/**
 * Token Vault connect-account follows
 * https://github.com/mtliendo/auth0-calendar-workshop — host-only Google.
 * Calendar scope and refresh tokens are NOT on login. Audience Universal
 * Login stays openid/profile/email. Only /auth/connect (host-gated) asks Google.
 */
export const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  secret: process.env.AUTH0_SECRET!,
  appBaseUrl: process.env.APP_BASE_URL!,
  enableConnectAccountEndpoint: true,
  authorizationParameters: {
    scope: LOGIN_SCOPES,
    audience: process.env.AUTH0_AUDIENCE,
  },
  async onCallback(error, ctx) {
    const appBaseUrl = ctx.appBaseUrl ?? process.env.APP_BASE_URL ?? 'http://localhost:3000'
    if (error) {
      const connectFailure =
        ctx.responseType === 'connect_code' ||
        (ctx.returnTo ?? '').startsWith('/settings')
      const path = connectFailure ? '/settings' : '/join'
      return NextResponse.redirect(
        new URL(`${path}?error=${encodeURIComponent(error.message)}`, appBaseUrl),
      )
    }
    return NextResponse.redirect(new URL(ctx.returnTo ?? '/', appBaseUrl))
  },
})

/**
 * Namespaced claim added by a post-login Auth0 Action. The CDK backend read the
 * same claim off the API Gateway JWT authorizer context; here it comes straight
 * off the session, so no separate authorizer is involved.
 */
export const POLICY_ID_CLAIM = 'https://claims.interview-demo.com/policyId'

export function policyIdFromUser(user: Record<string, unknown>): string | null {
  const value = user[POLICY_ID_CLAIM]
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** Fallback used when the Auth0 Action isn't configured on the tenant. */
export function generatePolicyId(): string {
  return `POL-2026-${Math.floor(10000 + Math.random() * 90000)}`
}

export function emailVerifiedFromUser(user: Record<string, unknown>): boolean {
  return user.email_verified === true
}

