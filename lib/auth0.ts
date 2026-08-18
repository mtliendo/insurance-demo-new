import { Auth0Client } from '@auth0/nextjs-auth0/server'

export const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  secret: process.env.AUTH0_SECRET!,
  appBaseUrl: process.env.APP_BASE_URL!,
  authorizationParameters: {
    scope: 'openid profile email',
    audience: process.env.AUTH0_AUDIENCE,
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
