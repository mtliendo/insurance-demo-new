import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth0 } from '@/lib/auth0'
import { isBoardDemoEnabled } from '@/lib/demo-flags'
import { isGoogleConnected } from '@/lib/google'
import { isAdmin } from '@/lib/host'
import { joinQrDataUrl, joinUrlFromHeaders } from '@/lib/qr'
import { SiteNav } from '@/components/site-nav'
import { HostClient } from '@/components/host-client'
import { HostConsole } from '@/components/host-console'

export const metadata = {
  title: 'Host console — Hero Shield Insurance',
}

export default async function HostPage() {
  const session = await auth0.getSession()
  if (!session) redirect('/auth/login?returnTo=/host')
  if (!isAdmin(session.user)) redirect('/')

  const sessionEmail = typeof session.user.email === 'string' ? session.user.email : ''

  if (!isBoardDemoEnabled()) {
    return (
      <>
        <SiteNav />
        <HostConsole
          sessionEmail={sessionEmail}
          googleConnected={await isGoogleConnected()}
        />
      </>
    )
  }

  const joinUrl = joinUrlFromHeaders(await headers())
  const qrDataUrl = await joinQrDataUrl(joinUrl)

  return (
    <>
      <SiteNav />
      <HostClient
        qrDataUrl={qrDataUrl}
        joinUrl={joinUrl}
        sessionEmail={sessionEmail}
        sessionSub={session.user.sub}
      />
    </>
  )
}
