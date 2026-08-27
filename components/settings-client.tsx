'use client'

import { CheckCircle2, Key, Shield, XCircle } from 'lucide-react'
import { hostConnectAccountHref } from '@/lib/google-connect'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export function SettingsClient({
  userName,
  userEmail,
  googleConnected,
  connectError,
  boardSize,
  yesThreshold,
}: {
  userName: string
  userEmail: string
  googleConnected: boolean
  connectError: string | null
  boardSize: number
  yesThreshold: number
}) {
  return (
    <div className="hud-grid relative min-h-screen overflow-hidden p-4 md:p-8">
      <div className="relative mx-auto max-w-2xl space-y-6">
        <div className="animate-rise">
          <span className="hud-label">Host settings</span>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight">
            Token Vault
          </h1>
          <p className="mt-2 text-muted-foreground">
            Only the host connects Google. The {boardSize} board members never do —
            they approve over CIBA email.
          </p>
        </div>

        {connectError && (
          <p className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {connectError}
          </p>
        )}

        <Card className="hud-panel animate-rise stagger-1 rounded-none border-transparent">
          <CardHeader className="pt-5">
            <CardTitle className="text-base uppercase">Host identity</CardTitle>
            <CardDescription>{userName}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="hud-readout text-sm text-muted-foreground">{userEmail}</p>
          </CardContent>
        </Card>

        <Card
          data-stone={googleConnected ? 'time' : 'mind'}
          className="hud-panel animate-rise stagger-2 rounded-none border-transparent"
        >
          <span className="absolute inset-x-0 top-0 h-0.5 bg-[var(--stone)]" />
          <CardHeader className="pt-5">
            <CardTitle className="flex items-center gap-2 text-base uppercase">
              <Key className="h-4 w-4" />
              Google Calendar
              {googleConnected ? (
                <Badge variant="success" className="ml-auto">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="warning" className="ml-auto">
                  <XCircle className="h-3 w-3" />
                  Not connected
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Auth0 Token Vault holds the Google refresh token. This app asks for a
              short-lived access token with{' '}
              <code className="text-[0.7rem]">getAccessTokenForConnection</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <a
              href={hostConnectAccountHref()}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-b from-gold to-[oklch(0.7_0.15_72)] px-5 py-2.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-[oklch(0.16_0.03_266)]"
            >
              {googleConnected ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
            </a>
            <Separator />
            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="flex gap-3">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-hud" />
                After {yesThreshold} CIBA yes{yesThreshold === 1 ? '' : 'es'} we create
                one event on this calendar. Board members never see a Google consent
                screen.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
