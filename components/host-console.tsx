'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarCheck, TriangleAlert } from 'lucide-react'
import { ClearClaimButton } from '@/components/clear-claim-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Admin console when the audience CIBA board is off. Token Vault Google
 * connect lives on /settings. No QR, pick board, or seated members.
 */
export function HostConsole({
  sessionEmail,
  googleConnected: initialGoogle,
}: {
  sessionEmail: string
  googleConnected: boolean
}) {
  const [googleConnected, setGoogleConnected] = useState(initialGoogle)

  const refreshGoogle = useCallback(async () => {
    const res = await fetch('/api/connection-status', { cache: 'no-store' })
    if (!res.ok) return
    const body = (await res.json()) as { connected?: boolean }
    setGoogleConnected(Boolean(body.connected))
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshGoogle()
    }, 4000)
    return () => clearInterval(timer)
  }, [refreshGoogle])

  return (
    <div className="hud-grid relative min-h-screen overflow-hidden p-4 md:p-8">
      <div className="relative mx-auto max-w-2xl space-y-6">
        <div className="animate-rise mb-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="hud-label">Operator console · Admin</span>
            <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight">
              Host
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Iowa Code Camp path: connect Google Calendar (Token Vault), file
              the Hulk claim, then cancel it with a CIBA email to this login.
            </p>
          </div>
          <ClearClaimButton onCleared={refreshGoogle} />
        </div>

        <Card className="hud-panel animate-rise rounded-none border-transparent">
          <CardHeader className="pt-5">
            <CardTitle className="text-base uppercase">Signed in</CardTitle>
            <CardDescription className="hud-readout">{sessionEmail}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Admin access is email-based (<span className="font-mono">admin@focusotter.com</span>
            {' '}or <span className="font-mono">@okta.com</span>). A stored Auth0 sub from
            an old tenant does not block Token Vault.
          </CardContent>
        </Card>

        <Card
          data-stone={googleConnected ? 'time' : 'mind'}
          className="hud-panel animate-rise stagger-1 rounded-none border-transparent"
        >
          <span className="absolute inset-x-0 top-0 h-0.5 bg-[var(--stone)]" />
          <CardHeader className="pt-5">
            <CardTitle className="flex items-center gap-2 text-base uppercase">
              {googleConnected ? (
                <CalendarCheck className="h-4 w-4 text-stone-time" />
              ) : (
                <TriangleAlert className="h-4 w-4 text-gold" />
              )}
              Google Calendar
              {googleConnected ? (
                <Badge variant="success" className="ml-auto">
                  Connected
                </Badge>
              ) : (
                <Badge variant="warning" className="ml-auto">
                  Not connected
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Auth0 Token Vault holds the Google refresh token. Connect on
              Settings, then file the claim so an event can be written.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant={googleConnected ? 'outline' : 'gold'}>
              <Link href="/settings">
                {googleConnected ? 'Token Vault settings' : 'Connect Google Calendar'}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/file-claim">File a claim</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
