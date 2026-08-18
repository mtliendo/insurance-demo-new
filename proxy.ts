import { NextResponse, type NextRequest } from 'next/server'
import { auth0 } from '@/lib/auth0'

/**
 * Next.js 16 renamed Middleware to Proxy. This mounts the Auth0 v4 routes
 * (/auth/login, /auth/logout, /auth/callback, /auth/profile) and guards the
 * authenticated pages — the job the API Gateway HttpJwtAuthorizer used to do.
 */
export async function proxy(request: NextRequest) {
  const authRes = await auth0.middleware(request)
  const { pathname, origin } = request.nextUrl

  // Auth0 SDK routes.
  if (pathname.startsWith('/auth')) return authRes

  // Public: landing page and the audience approver screen.
  if (pathname === '/' || pathname.startsWith('/approve')) return authRes

  // API routes do their own session check so they can return 401 JSON
  // instead of redirecting a fetch() to the Auth0 login page.
  if (pathname.startsWith('/api')) return authRes

  const session = await auth0.getSession(request)
  if (!session) {
    return NextResponse.redirect(
      `${origin}/auth/login?returnTo=${encodeURIComponent(pathname)}`,
    )
  }

  return authRes
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
}
