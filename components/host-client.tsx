'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarCheck, Pin, PinOff, QrCode, Shuffle, TriangleAlert } from 'lucide-react'
import { BoardPanel } from '@/components/board-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { CibaBoardSnapshot } from '@/lib/types'

type Joiner = {
  sub: string
  email: string
  name: string
  emailVerified: boolean
  pinned: boolean
}

type BoardState = {
  joiners: Joiner[]
  board: { sub: string; email: string; name: string }[]
  boardSize: number
  canPick: boolean
  googleConnected: boolean
  claim: {
    id: string
    status: string
    policyId: string
    incidentDescription: string | null
    calendarEventId: string | null
    board: CibaBoardSnapshot
  } | null
}

const POLL_MS = 2000

export function HostClient({
  qrDataUrl,
  joinUrl,
}: {
  qrDataUrl: string
  joinUrl: string
}) {
  const [state, setState] = useState<BoardState | null>(null)
  const [picking, setPicking] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/board', { cache: 'no-store' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Board ${res.status}`)
    }
    setState((await res.json()) as BoardState)
  }, [])

  useEffect(() => {
    let active = true
    const tick = () =>
      load()
        .then(() => {
          if (active) setError(null)
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : 'Load failed')
        })
    tick()
    const timer = setInterval(tick, POLL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [load])

  const pick = async () => {
    setPicking(true)
    try {
      const res = await fetch('/api/board/pick', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Pick failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pick failed')
    } finally {
      setPicking(false)
    }
  }

  const pin = async (sub: string, pinned: boolean) => {
    await fetch('/api/board/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sub, pinned }),
    })
    await load()
  }

  const startCiba = async () => {
    setStarting(true)
    try {
      const res = await fetch('/api/ciba', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'CIBA start failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CIBA start failed')
    } finally {
      setStarting(false)
    }
  }

  const verified = state?.joiners.filter((j) => j.emailVerified) ?? []
  const unverified = state?.joiners.filter((j) => !j.emailVerified) ?? []
  const blockReason = state?.claim?.board.blockReason
  const needsCibaStart =
    state?.claim?.status === 'awaiting_approval' &&
    state.claim.board.members.length > 0 &&
    !state.claim.board.started &&
    !blockReason

  return (
    <div className="hud-grid relative min-h-screen overflow-hidden p-4 md:p-8">
      <div className="relative mx-auto max-w-6xl">
        <div className="animate-rise mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="hud-label">Operator console · Focus</span>
            <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight md:text-4xl">
              CIBA board
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              One QR for the room. Pick six. File the Hulk claim. Three email yeses
              release it and write your calendar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="hud" size="sm">
              <Link href="/settings">Google Calendar</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/file-claim">File a claim</Link>
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
          <Card className="hud-panel animate-rise rounded-none border-transparent">
            <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-gold to-hud" />
            <CardHeader className="pt-5">
              <CardTitle className="flex items-center gap-2 text-base uppercase">
                <QrCode className="h-4 w-4 text-hud" />
                Room QR
              </CardTitle>
              <CardDescription>Everyone scans this, logs in, and waits.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="Join the claims board"
                className="mx-auto w-full max-w-[16rem] rounded-sm border border-hud/30"
              />
              <p className="hud-readout break-all text-center text-[0.65rem] text-muted-foreground">
                {joinUrl}
              </p>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {!state?.googleConnected && (
              <Card data-stone="mind" className="hud-panel rounded-none border-transparent">
                <span className="absolute inset-x-0 top-0 h-0.5 bg-[var(--stone)]" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base uppercase">
                    <TriangleAlert className="h-4 w-4 text-gold" />
                    Connect Google first
                  </CardTitle>
                  <CardDescription>
                    CIBA emails will not go out until the host Token Vault connection is live.
                    Otherwise a yes is hollow — there is nowhere to write the calendar event.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="gold">
                    <Link href="/settings">Connect Google Calendar</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="hud-panel animate-rise stagger-1 rounded-none border-transparent">
              <CardHeader className="flex flex-row items-start justify-between gap-4 pt-5">
                <div>
                  <CardTitle className="text-base uppercase">Joiners</CardTitle>
                  <CardDescription>
                    {verified.length} verified · pin planted friends, then pick
                  </CardDescription>
                </div>
                <Button onClick={() => void pick()} disabled={picking || state?.canPick === false}>
                  <Shuffle className="h-4 w-4" />
                  {picking ? 'Picking…' : 'Pick board'}
                </Button>
              </CardHeader>
              <Separator />
              <CardContent className="space-y-2 pt-4">
                {state === null && <p className="hud-label animate-blink">Syncing room…</p>}
                {state?.joiners.length === 0 && (
                  <p className="text-sm text-muted-foreground">No one has scanned in yet.</p>
                )}
                {verified.map((joiner) => (
                  <div
                    key={joiner.sub}
                    className="flex items-center justify-between gap-3 rounded-sm border border-border/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{joiner.name}</p>
                      <p className="hud-readout truncate text-[0.65rem] text-muted-foreground">
                        {joiner.email}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={joiner.pinned ? 'gold' : 'outline'}
                      onClick={() => void pin(joiner.sub, !joiner.pinned)}
                    >
                      {joiner.pinned ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
                      {joiner.pinned ? 'Pinned' : 'Pin'}
                    </Button>
                  </div>
                ))}
                {unverified.length > 0 && (
                  <p className="pt-2 text-xs text-muted-foreground">
                    {unverified.length} unverified — they can watch, they cannot sit.
                  </p>
                )}
                {state?.canPick === false && (
                  <p className="text-xs text-gold">
                    CIBA is live for a claim. Reset the claim before picking again.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card
              data-stone={state?.claim?.status === 'approved' ? 'time' : 'space'}
              className="hud-panel animate-rise stagger-2 rounded-none border-transparent"
            >
              <CardHeader className="pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base uppercase">Projector board</CardTitle>
                    <CardDescription>
                      {state?.claim
                        ? `${state.claim.policyId} · ${state.claim.status}`
                        : 'No claim submitted yet'}
                    </CardDescription>
                  </div>
                  {state?.claim?.calendarEventId && (
                    <Badge variant="success">
                      <CalendarCheck className="h-3 w-3" />
                      Calendar written
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="space-y-4 pt-5">
                {blockReason === 'no_google' && (
                  <p className="text-sm text-gold">
                    Claim is waiting. Connect Google, then send the six CIBA emails.
                  </p>
                )}
                {blockReason === 'no_board' && (
                  <p className="text-sm text-gold">
                    Claim is waiting. Pick a board of six, then send CIBA.
                  </p>
                )}
                {(blockReason || needsCibaStart) && state?.googleConnected && (
                  <Button onClick={() => void startCiba()} disabled={starting || !state.board.length}>
                    {starting ? 'Sending…' : 'Send CIBA emails'}
                  </Button>
                )}
                {state?.claim ? (
                  <BoardPanel board={state.claim.board} />
                ) : state?.board.length ? (
                  <BoardPanel
                    board={{
                      members: state.board.map((m) => ({
                        ...m,
                        status: 'pending',
                      })),
                      approvedCount: 0,
                      requiredApprovals: 3,
                      boardSize: state.boardSize,
                      blockReason: null,
                      calendarEventId: null,
                      started: false,
                    }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Pick a board to seat six names.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
