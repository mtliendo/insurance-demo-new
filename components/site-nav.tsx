'use client'

import Link from 'next/link'
import { useUser } from '@auth0/nextjs-auth0'
import { FileText, LogIn, LogOut, Settings, ShieldHalf, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/join', label: 'Join' },
  { href: '/host', label: 'Board' },
]

export function SiteNav() {
  const { user, isLoading } = useUser()

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      {/* Hairline of cyan under the bar — the edge of a HUD overlay. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-hud/50 to-transparent" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="group flex items-center gap-3">
            <span className="relative grid h-9 w-9 place-items-center">
              {/* Badge plate: red core, cyan ring that charges on hover. */}
              <span className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-transparent ring-1 ring-primary/40 transition-all duration-500 group-hover:ring-hud/70 group-hover:shadow-[0_0_18px_-2px_oklch(0.82_0.13_197_/_0.8)]" />
              <ShieldHalf className="relative h-5 w-5 text-primary transition-colors duration-500 group-hover:text-hud" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-lg font-bold uppercase tracking-[0.08em] text-foreground">
                Hero Shield
              </span>
              <span className="hud-label text-[0.6rem] tracking-[0.3em] text-muted-foreground transition-colors duration-500 group-hover:text-hud">
                Insurance
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {LINKS.map(({ href, label }) => (
              <Link
                key={label}
                href={href}
                className="group relative font-display text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
              >
                {label}
                {/* Underline wipes out from the left on hover. */}
                <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-hud transition-all duration-300 group-hover:w-full group-hover:shadow-[0_0_8px_oklch(0.82_0.13_197)]" />
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="h-9 w-24 animate-pulse rounded-md bg-muted/60" />
            ) : user ? (
              <>
                <Button asChild size="sm" className="hidden sm:inline-flex">
                  <Link href="/file-claim">
                    <FileText className="mr-2 h-4 w-4" />
                    File a Claim
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/settings" aria-label="Host settings">
                    <Settings className="h-4 w-4 sm:mr-2" />
                    <span className="hidden md:inline">Settings</span>
                  </Link>
                </Button>
                <Link href="/profile" className="group relative">
                  {/* Dashed ring spins up when you hover the avatar. */}
                  <span className="pointer-events-none absolute -inset-1 rounded-full border border-dashed border-hud/0 transition-colors duration-300 group-hover:border-hud/60 group-hover:[animation:spin_6s_linear_infinite]" />
                  <Avatar className="h-9 w-9 cursor-pointer ring-1 ring-border transition-all duration-300 group-hover:ring-hud">
                    <AvatarImage src={user.picture ?? undefined} alt={user.name ?? 'User'} />
                    <AvatarFallback className="bg-secondary">
                      <User className="h-4 w-4 text-hud" />
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <Button asChild variant="ghost" size="sm">
                  <a href="/auth/logout" aria-label="Log out">
                    <LogOut className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Logout</span>
                  </a>
                </Button>
              </>
            ) : (
              <Button asChild size="sm">
                <a href="/auth/login">
                  <LogIn className="mr-2 h-4 w-4" />
                  Login
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

/**
 * Audience phones on /join. Logo + logout only — File a Claim and Settings
 * wander the room off the QR path.
 */
export function AudienceNav() {
  const { user, isLoading } = useUser()

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-hud/50 to-transparent" />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/join" className="group flex items-center gap-3">
            <span className="relative grid h-9 w-9 place-items-center">
              <span className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-transparent ring-1 ring-primary/40" />
              <ShieldHalf className="relative h-5 w-5 text-primary" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-lg font-bold uppercase tracking-[0.08em] text-foreground">
                Hero Shield
              </span>
              <span className="hud-label text-[0.6rem] tracking-[0.3em] text-muted-foreground">
                Audience
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="h-9 w-16 animate-pulse rounded-md bg-muted/60" />
            ) : user ? (
              <Button asChild variant="ghost" size="sm">
                <a href="/auth/logout" aria-label="Log out">
                  <LogOut className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Logout</span>
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  )
}

/** Hero CTA — needs the session to decide between "get covered" and "file a claim". */
export function HeroActions() {
  const { user, isLoading } = useUser()

  // Reserve the row's height so the hero doesn't jump when the session lands.
  if (isLoading) return <div className="h-12" />

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <Button asChild size="lg" variant={user ? 'default' : 'gold'}>
        {user ? (
          <Link href="/file-claim">File a Claim</Link>
        ) : (
          <a href="/auth/login">Get Covered Today</a>
        )}
      </Button>
      <Button asChild size="lg" variant="hud">
        {user ? <Link href="/profile">View Coverage</Link> : <Link href="/join">Join the room</Link>}
      </Button>
    </div>
  )
}
