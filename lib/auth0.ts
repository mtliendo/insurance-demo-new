import { Auth0Client } from '@auth0/nextjs-auth0/server'
import { NextResponse } from 'next/server'

export const LOGIN_SCOPES = 'openid profile email offline_access'

export const POLICY_ID_CLAIM = 'https://claims.interview-demo.com/policyId'

export function policyIdFromUser(user: Record<string, unknown>): string | null {
  const value = user[POLICY_ID_CLAIM]
  return typeof value === 'string' && value ? value : null
}

export const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  secret: process.env.AUTH0_SECRET!,
  appBaseUrl: process.env.APP_BASE_URL!,
  enableConnectAccountEndpoint: true,
  authorizationParameters: {
    scope: LOGIN_SCOPES,
  },
  async onCallback(error, ctx) {
    const appBaseUrl =
      ctx.appBaseUrl ?? process.env.APP_BASE_URL ?? 'http://localhost:3000'
    if (error) {
      const connectFailure =
        ctx.responseType === 'connect_code' ||
        (ctx.returnTo ?? '').startsWith('/settings')
      const path = connectFailure ? '/settings' : '/join'
      return NextResponse.redirect(
        new URL(
          `${path}?error=${encodeURIComponent(error.message)}`,
          appBaseUrl,
        ),
      )
    }
    return NextResponse.redirect(new URL(ctx.returnTo ?? '/', appBaseUrl))
  },
})

export function generatePolicyId(): string {
  return `POL-2026-${Math.floor(10000 + Math.random() * 90000)}`
}

export function emailVerifiedFromUser(user: Record<string, unknown>): boolean {
  return user.email_verified === true
}
