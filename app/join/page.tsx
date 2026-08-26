import { redirect } from 'next/navigation'
import { auth0 } from '@/lib/auth0'
import { SiteNav } from '@/components/site-nav'
import { JoinClient } from '@/components/join-client'

export const metadata = {
  title: 'Join the board — Hero Shield Insurance',
}

export default async function JoinPage() {
  const session = await auth0.getSession()
  if (!session) redirect('/auth/login?returnTo=/join')

  return (
    <>
      <SiteNav />
      <JoinClient
        userName={session.user.name ?? session.user.email ?? 'there'}
        userEmail={typeof session.user.email === 'string' ? session.user.email : ''}
      />
    </>
  )
}
