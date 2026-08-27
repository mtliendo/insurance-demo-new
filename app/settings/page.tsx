import { redirect } from 'next/navigation'
import { auth0 } from '@/lib/auth0'
import { getBoardSize, getCibaYesThreshold } from '@/lib/board-config'
import { isGoogleConnected } from '@/lib/google'
import { isDemoHost } from '@/lib/host'
import { SiteNav } from '@/components/site-nav'
import { SettingsClient } from '@/components/settings-client'

export const metadata = {
  title: 'Host settings — Hero Shield Insurance',
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>
}) {
  const session = await auth0.getSession()
  if (!session) redirect('/auth/login?returnTo=/settings')
  if (!isDemoHost(session.user)) redirect('/join')

  const params = await searchParams
  const error = typeof params.error === 'string' ? params.error : null

  return (
    <>
      <SiteNav />
      <SettingsClient
        userName={session.user.name ?? 'Host'}
        userEmail={typeof session.user.email === 'string' ? session.user.email : ''}
        googleConnected={await isGoogleConnected()}
        connectError={error}
        boardSize={getBoardSize()}
        yesThreshold={getCibaYesThreshold()}
      />
    </>
  )
}
