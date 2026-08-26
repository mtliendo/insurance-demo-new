'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Mail, Radar, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type JoinState = {
  host: boolean
  emailVerified: boolean
  onBoard: boolean
  joiner: { name: string; email: string } | null
  claimStatus: string | null
  ciba: { status: string; bindingMessage: string; error: string | null } | null
}

const POLL_MS = 2000

export function JoinLogin({ authError }: { authError: string | null }) {
  return (
    <JoinShell>
      {authError && (
        <p className="mb-4 rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
          {authError}
        </p>
      )}
      <Card className="hud-panel rounded-none border-transparent">
        <CardHeader className="items-center py-14 text-center">
          <Radar className="mb-4 h-10 w-10 text-hud" />
          <CardTitle className="uppercase">Join the room</CardTitle>
          <CardDescription className="max-w-sm">
            Log in with Auth0. A verified email is required to sit on the CIBA board.
          </CardDescription>
          <a
            href="/auth/login?returnTo=/join"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-gradient-to-b from-primary to-[oklch(0.5_0.2_25)] px-5 py-2.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground"
          >
            Log in
          </a>
        </CardHeader>
      </Card>
    </JoinShell>
  )
}

export function JoinClient({
  userName,
  userEmail,
  authError,
}: {
  userName: string
  userEmail: string
  authError?: string | null
}) {
  const [state, setState] = useState<JoinState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const tick = async () => {
      try {
        const joined = await fetch('/api/join', { method: 'POST' })
        if (!joined.ok && joined.status !== 409) {
          const body = await joined.json().catch(() => ({}))
          throw new Error(body.error || `Join failed (${joined.status})`)
        }
        const res = await fetch('/api/join', { cache: 'no-store' })
        if (!res.ok) throw new Error(`Status ${res.status}`)
        const next = (await res.json()) as JoinState
        if (active) {
          setState(next)
          setError(null)
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Join failed')
      }
    }

    void tick()
    const timer = setInterval(() => void tick(), POLL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  if (state?.host) {
    return (
      <JoinShell>
        <Card className="hud-panel rounded-none border-transparent">
          <CardHeader className="items-center py-14 text-center">
            <ShieldCheck className="mb-4 h-10 w-10 text-gold" />
            <CardTitle className="uppercase">You are the operator</CardTitle>
            <CardDescription className="max-w-sm">
              This QR is for the room. Open the host console to pick the board.
            </CardDescription>
            <a href="/host" className="mt-6 text-sm text-hud underline">
              Go to host console
            </a>
          </CardHeader>
        </Card>
      </JoinShell>
    )
  }

  if (!state?.emailVerified && state) {
    return (
      <JoinShell>
        <Card data-stone="reality" className="hud-panel rounded-none border-transparent">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-[var(--stone)]" />
          <CardHeader className="items-center py-14 text-center">
            <TriangleAlert className="mb-4 h-10 w-10 text-stone-reality" />
            <CardTitle className="uppercase">Email not verified</CardTitle>
            <CardDescription className="max-w-sm">
              Auth0 CIBA email only reaches a verified inbox. Verify {userEmail} before you can
              sit on the claims board.
            </CardDescription>
          </CardHeader>
        </Card>
      </JoinShell>
    )
  }

  if (state?.onBoard) {
    const ciba = state.ciba
    return (
      <JoinShell>
        <Card data-stone="time" className="hud-panel glow-stone rounded-none border-transparent">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-[var(--stone)]" />
          <CardHeader className="items-center py-12 text-center">
            <span className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-stone-time/15 ring-1 ring-stone-time/50">
              <CheckCircle2 className="h-8 w-8 text-stone-time" />
            </span>
            <span className="hud-label text-stone-time">Seated</span>
            <CardTitle className="mt-2 text-3xl uppercase">You&apos;re on the board</CardTitle>
            <CardDescription className="max-w-sm text-base">
              {userName}, you are one of the six. Watch the projector — your name is up there.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pb-10 text-center">
            {ciba?.status === 'pending' && (
              <p className="flex items-center justify-center gap-2 text-sm text-gold">
                <Mail className="h-4 w-4" />
                Check {userEmail} — Accept the CIBA mail.
              </p>
            )}
            {ciba?.status === 'approved' && (
              <Badge variant="success">You approved this claim</Badge>
            )}
            {ciba?.status === 'denied' && (
              <Badge variant="destructive">You declined this claim</Badge>
            )}
            {ciba?.bindingMessage && (
              <p className="hud-readout text-xs text-muted-foreground">
                Binding message · {ciba.bindingMessage}
              </p>
            )}
          </CardContent>
        </Card>
      </JoinShell>
    )
  }

  return (
    <JoinShell>
      {authError && (
        <p className="mb-4 rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
          {authError}
        </p>
      )}
      <Card className="hud-panel rounded-none border-transparent">
        <CardHeader className="items-center py-14 text-center">
          <span className="relative mb-5 grid h-16 w-16 place-items-center">
            <span className="absolute inset-0 rounded-full border border-dashed border-hud/40 [animation:spin_8s_linear_infinite]" />
            <Radar className="h-7 w-7 text-hud/70" />
          </span>
          <CardTitle className="uppercase">In the room</CardTitle>
          <CardDescription className="max-w-sm">
            {error ??
              'Logged in. Waiting for the operator to pick the board of six. Keep this page open.'}
          </CardDescription>
          <Badge variant="hud" className="mt-4">
            {state?.joiner ? 'Joined' : 'Connecting…'}
          </Badge>
        </CardHeader>
      </Card>
    </JoinShell>
  )
}

function JoinShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="hud-grid relative min-h-screen overflow-hidden p-4 md:p-8">
      <div className="relative mx-auto max-w-lg">
        <div className="animate-rise mb-8 text-center">
          <span className="hud-label">Audience join · Sector 616</span>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight">
            Claims board
          </h1>
        </div>
        {children}
      </div>
    </div>
  )
}
