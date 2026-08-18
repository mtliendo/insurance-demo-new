import Image from 'next/image'
import { redirect } from 'next/navigation'
import { auth0, POLICY_ID_CLAIM, policyIdFromUser } from '@/lib/auth0'
import { SiteNav } from '@/components/site-nav'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export default async function ProfilePage() {
  const session = await auth0.getSession()
  if (!session) redirect('/auth/login?returnTo=/profile')

  const { user } = session
  const policyId = policyIdFromUser(user)

  return (
    <>
      <SiteNav />
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">Your Profile</h1>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                {user.picture ? (
                  <Image
                    src={user.picture}
                    alt={user.name ?? 'Profile picture'}
                    width={64}
                    height={64}
                    className="rounded-full"
                    unoptimized
                  />
                ) : (
                  <Avatar className="h-16 w-16">
                    <AvatarFallback>{(user.name ?? '?').charAt(0)}</AvatarFallback>
                  </Avatar>
                )}
                <div>
                  <CardTitle>{user.name}</CardTitle>
                  <CardDescription>{user.email}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6 space-y-4">
              <Row label="Auth0 user ID" value={user.sub} />
              <Separator />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Policy number</p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono break-all">
                    {POLICY_ID_CLAIM}
                  </p>
                </div>
                {policyId ? (
                  <Badge className="bg-green-500 hover:bg-green-600 shrink-0">{policyId}</Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0">
                    Claim not set
                  </Badge>
                )}
              </div>
              {!policyId && (
                <p className="text-xs text-muted-foreground">
                  Add a post-login Auth0 Action that sets this namespaced claim to surface the
                  policy number on the token. Until then a policy number is generated per claim.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3 mt-6">
            <Button asChild>
              <a href="/file-claim">File a Claim</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/auth/logout">Logout</a>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-sm text-muted-foreground font-mono break-all text-right">{value}</p>
    </div>
  )
}
