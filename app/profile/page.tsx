import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BadgeCheck, Fingerprint } from 'lucide-react'
import { auth0, POLICY_ID_CLAIM, policyIdFromUser } from '@/lib/auth0'
import { SiteNav } from '@/components/site-nav'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export default async function ProfilePage() {
  const session = await auth0.getSession()
  if (!session) redirect('/auth/login?returnTo=/profile')

  const { user } = session
  const policyId = policyIdFromUser(user)

  return (
    <>
      <SiteNav />
      <div className="hud-grid relative min-h-screen overflow-hidden p-4 md:p-8">
        <div className="relative mx-auto max-w-2xl">
          <div className="animate-rise mb-8">
            <span className="hud-label">Identity Record</span>
            <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight md:text-4xl">
              Your Profile
            </h1>
          </div>

          {/* Policyholder ID card. */}
          <Card
            data-stone={policyId ? 'time' : 'space'}
            className="animate-rise stagger-1 hud-panel rounded-none border-transparent"
          >
            <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-gold to-hud" />

            <CardHeader className="pt-7">
              <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                  {/* Dashed clearance ring around the portrait. */}
                  <span className="absolute -inset-1.5 rounded-full border border-dashed border-hud/45 [animation:spin_14s_linear_infinite]" />
                  {user.picture ? (
                    <Image
                      src={user.picture}
                      alt={user.name ?? 'Profile picture'}
                      width={72}
                      height={72}
                      className="relative rounded-full ring-1 ring-border"
                      unoptimized
                    />
                  ) : (
                    <Avatar className="relative h-[72px] w-[72px] ring-1 ring-border">
                      <AvatarFallback className="bg-secondary font-display text-xl text-hud">
                        {(user.name ?? '?').charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>

                <div className="min-w-0">
                  <CardTitle className="truncate text-2xl uppercase">{user.name}</CardTitle>
                  <p className="hud-readout mt-1 truncate text-sm text-muted-foreground">
                    {user.email}
                  </p>
                  <Badge variant="hud" className="mt-3">
                    <BadgeCheck className="h-3 w-3" />
                    Verified policyholder
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <Separator />

            <CardContent className="space-y-5 pt-6">
              <div>
                <span className="hud-label text-[0.6rem]">Auth0 user ID</span>
                <p className="hud-readout mt-1 flex items-center gap-2 break-all text-sm text-foreground/85">
                  <Fingerprint className="h-3.5 w-3.5 shrink-0 text-hud" />
                  {user.sub}
                </p>
              </div>

              <Separator />

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="hud-label text-[0.6rem]">Policy number</span>
                  <p className="hud-readout mt-1 break-all text-[0.7rem] text-muted-foreground/70">
                    {POLICY_ID_CLAIM}
                  </p>
                </div>
                <Badge variant={policyId ? 'success' : 'secondary'} className="shrink-0">
                  {policyId ?? 'Claim not set'}
                </Badge>
              </div>

              {!policyId && (
                <p className="rounded-sm border border-border/70 bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
                  Add a post-login Auth0 Action that sets this namespaced claim to surface the
                  policy number on the token. Until then a policy number is generated per claim.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="animate-rise stagger-2 mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/file-claim">File a Claim</Link>
            </Button>
            <Button asChild size="lg" variant="hud">
              <a href="/auth/logout">Logout</a>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
