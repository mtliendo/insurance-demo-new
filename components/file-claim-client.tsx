'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Confetti from 'react-confetti'
import { CheckCircle2, Send, ShieldHalf } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { BoardPanel } from '@/components/board-panel'
import type { ClaimSnapshot } from '@/lib/types'
import { CIBA_REQUIRED_APPROVALS } from '@/lib/types'

const POLL_INTERVAL_MS = 2000

/** Infinity-stone palette, in hex — react-confetti can't parse oklch(). */
const CONFETTI_COLORS = ['#ff3b30', '#ffc400', '#3ea6ff', '#a855f7', '#22e08a', '#ff8a2b']

export function FileClaimClient({ userLabel }: { userLabel: string }) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [snapshot, setSnapshot] = useState<ClaimSnapshot | null>(null)
  const [currentMessage, setCurrentMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })

  // Start (or resume) the claim.
  useEffect(() => {
    let cancelled = false
    fetch('/api/claims', { method: 'POST' })
      .then((res) => res.json())
      .then((data: ClaimSnapshot) => {
        if (!cancelled) setSnapshot(data)
      })
      .catch((error) => console.error('Failed to start claim:', error))
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * Polling stands in for the AppSync Events subscription. Once the agent has
   * submitted the claim, the audience approves it from /approve and the count
   * lands in Neon; this loop is how the page learns about it.
   */
  const status = snapshot?.claim.status
  const claimId = snapshot?.claim.id

  useEffect(() => {
    if (!claimId || status !== 'awaiting_approval') return

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/claims/${claimId}`, { cache: 'no-store' })
        if (!res.ok) return
        const next: ClaimSnapshot = await res.json()
        setSnapshot(next)
        if (next.claim.status === 'approved') setShowApprovalModal(true)
      } catch (error) {
        console.error('Poll failed:', error)
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [claimId, status])

  useEffect(() => {
    const onResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [snapshot?.messages.length])

  const sendMessage = useCallback(async () => {
    const text = currentMessage.trim()
    if (!text || isSending || !snapshot) return

    // Optimistic echo so the input clears immediately.
    setSnapshot({
      ...snapshot,
      messages: [...snapshot.messages, { role: 'user', content: text }],
    })
    setCurrentMessage('')
    setIsSending(true)

    try {
      const res = await fetch(`/api/claims/${snapshot.claim.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      setSnapshot(await res.json())
    } catch (error) {
      console.error('Error sending message:', error)
      setSnapshot((prev) =>
        prev
          ? {
              ...prev,
              messages: [
                ...prev.messages,
                {
                  role: 'assistant',
                  content: 'Sorry, I encountered an error. Please try again in a moment.',
                },
              ],
            }
          : prev,
      )
    } finally {
      setIsSending(false)
    }
  }, [currentMessage, isSending, snapshot])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  if (!snapshot) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6">
        <div className="arc-reactor h-24 w-24" />
        <p className="hud-label animate-blink">Establishing secure claim channel…</p>
      </div>
    )
  }

  const { claim, messages, approvalCount, board, googleConnected } = snapshot
  const remaining = CIBA_REQUIRED_APPROVALS - approvalCount
  const isApproved = claim.status === 'approved'
  const isAwaiting = claim.status === 'awaiting_approval'

  return (
    <div className="hud-grid relative min-h-screen overflow-hidden p-4 md:p-8">
      {showApprovalModal && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle
          numberOfPieces={500}
          colors={CONFETTI_COLORS}
        />
      )}

      {showApprovalModal && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background/85 p-4 backdrop-blur-md">
          {/* Sling-ring burst behind the card. */}
          <div className="portal-ring left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 opacity-70" />

          <Card
            data-stone="time"
            className="animate-pop hud-panel relative w-full max-w-md rounded-none border-transparent glow-stone"
          >
            <span className="absolute inset-x-0 top-0 h-0.5 bg-stone-time" />
            <CardHeader className="items-center pt-8 text-center">
              <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-stone-time/15 ring-1 ring-stone-time/50">
                <CheckCircle2 className="h-8 w-8 text-stone-time" />
              </span>
              <span className="hud-label text-stone-time">Claim cleared</span>
              <CardTitle className="mt-2 text-2xl uppercase">Claim Approved</CardTitle>
              <CardDescription className="text-base">
                The CIBA board of six hit three email yeses. The claim is
                released
                {claim.calendarEventId ? ' and written to the host calendar.' : '.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-5">
              <p className="text-center text-sm text-muted-foreground">
                {claim.calendarEventId
                  ? 'Token Vault wrote the event on the operator calendar. The room likes ticker was never the grant.'
                  : 'The seated board authorized this claim over CIBA email. The room likes ticker was never the grant.'}
              </p>
              <Button onClick={() => setShowApprovalModal(false)} className="w-full">
                Acknowledge
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="relative mx-auto max-w-6xl">
        <div className="animate-rise mb-8">
          <span className="hud-label">Claim Intake · Sector 616</span>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight md:text-4xl">
            File a Claim
          </h1>
          <p className="mt-2 text-muted-foreground">
            Welcome, <span className="text-foreground">{userLabel}</span>. Describe your
            incident to the claims assistant and it will build the report as you talk.
          </p>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* ---- Chat console ---------------------------------------------- */}
          <Card className="animate-rise stagger-1 hud-panel flex h-[620px] flex-1 flex-col rounded-none border-transparent">
            <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-gold to-hud" />

            <CardHeader className="pb-3 pt-5">
              <div className="flex items-center gap-3">
                <div className="arc-reactor h-9 w-9 shrink-0" />
                <div>
                  <CardTitle className="text-base uppercase tracking-wide">
                    Claims Assistant
                  </CardTitle>
                  <CardDescription className="hud-readout text-[0.7rem] uppercase tracking-[0.12em]">
                    <span className="text-stone-time">● Online</span> · Anthropic agent
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />

            <CardContent className="flex flex-1 flex-col overflow-hidden p-4">
              <div className="mb-4 flex-1 space-y-4 overflow-y-auto pr-2">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`animate-message-in flex gap-3 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-hud/12 ring-1 ring-hud/40">
                        <ShieldHalf className="h-3.5 w-3.5 text-hud" />
                      </span>
                    )}
                    <div
                      className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed ${
                        message.role === 'user'
                          ? 'rounded-l-lg rounded-br-lg bg-gradient-to-br from-primary to-[oklch(0.48_0.19_25)] text-primary-foreground shadow-[0_8px_24px_-10px_oklch(0.585_0.215_27)]'
                          : 'rounded-r-lg rounded-bl-lg border border-border/70 bg-secondary/60 text-foreground/90'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}

                {isSending && (
                  <div className="animate-message-in flex justify-start gap-3">
                    <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-hud/12 ring-1 ring-hud/40">
                      <ShieldHalf className="h-3.5 w-3.5 text-hud" />
                    </span>
                    <div className="flex items-center gap-3 rounded-r-lg rounded-bl-lg border border-border/70 bg-secondary/60 px-4 py-3">
                      <span className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="dot-charge h-1.5 w-1.5 rounded-full bg-hud"
                            style={{ animationDelay: `${i * 0.16}s` }}
                          />
                        ))}
                      </span>
                      <span className="hud-label text-[0.6rem]">Analyzing</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="flex gap-2">
                <textarea
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe what happened…"
                  className="max-h-[120px] min-h-[44px] flex-1 resize-none rounded-md border border-input bg-background/60 px-3 py-2.5 text-sm transition-all placeholder:text-muted-foreground/70 focus:border-hud/60 focus:outline-none focus:ring-2 focus:ring-hud/30"
                  disabled={isSending}
                  rows={1}
                />
                <Button
                  onClick={() => void sendMessage()}
                  disabled={isSending || !currentMessage.trim()}
                  className="h-auto self-stretch px-5"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ---- Claim manifest -------------------------------------------- */}
          <Card
            data-stone={isApproved ? 'time' : isAwaiting ? 'mind' : 'space'}
            className="animate-rise stagger-2 hud-panel h-fit rounded-none border-transparent lg:w-80"
          >
            <span className="absolute inset-x-0 top-0 h-0.5 bg-[var(--stone)] transition-colors duration-700" />

            <CardHeader className="pb-3 pt-5">
              <CardTitle className="text-base uppercase tracking-wide">Claim Manifest</CardTitle>
              <CardDescription className="hud-readout text-[0.7rem]">
                ID {claim.id.slice(0, 8).toUpperCase()}
              </CardDescription>
            </CardHeader>
            <Separator />

            <CardContent className="space-y-4 p-4">
              <Field label="User ID" value={claim.userId} placeholder="Waiting…" truncate />
              <Field label="Policy Number" value={claim.policyId} placeholder="Waiting…" mono />
              <Field
                label="Incident"
                value={claim.incidentDescription}
                placeholder="Describe what happened…"
              />
              <Field
                label="Location"
                value={claim.incidentLocation}
                placeholder="Where did it happen?"
              />
              <Field
                label="Damage Extent"
                value={claim.damageExtent}
                placeholder="How severe is the damage?"
              />

              <Separator />

              <div>
                <div className="flex items-center justify-between">
                  <span className="hud-label text-[0.6rem]">Status</span>
                  <Badge variant={isApproved ? 'success' : isAwaiting ? 'warning' : 'secondary'}>
                    {isAwaiting
                      ? `CIBA ${approvalCount}/${CIBA_REQUIRED_APPROVALS}`
                      : isApproved
                        ? 'Approved'
                        : claim.status}
                  </Badge>
                </div>

                {isAwaiting && !googleConnected && (
                  <p className="mt-3 text-xs text-gold">
                    Connect Google Calendar on Settings before CIBA emails go out.
                    Approval is hollow without a host calendar.
                  </p>
                )}

                {isAwaiting && board.blockReason === 'no_board' && (
                  <p className="mt-3 text-xs text-gold">
                    Pick a board of six on the host console, then send CIBA.
                  </p>
                )}

                {(isAwaiting || isApproved) && board.members.length > 0 && (
                  <div className="animate-fade-in mt-3">
                    <BoardPanel board={board} compact />
                    {remaining > 0 && isAwaiting && board.started && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {remaining} more CIBA yes{remaining > 1 ? 'es' : ''} to clear
                      </p>
                    )}
                  </div>
                )}

                {isApproved && (
                  <div className="animate-fade-in mt-3 space-y-2 text-sm text-stone-time">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Cleared by the CIBA board
                    </div>
                    {claim.calendarEventId && (
                      <p className="text-xs text-muted-foreground">
                        Calendar event written on the host account.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

/**
 * One line of the manifest. Pulses once at the moment the agent's
 * save_claim_details write lands — that flash is the tool call becoming
 * visible, which is the beat the demo is built around.
 */
function Field({
  label,
  value,
  placeholder,
  truncate,
  mono,
}: {
  label: string
  value: string | null
  placeholder: string
  truncate?: boolean
  mono?: boolean
}) {
  const [flash, setFlash] = useState(false)
  const previous = useRef(value)

  useEffect(() => {
    if (!previous.current && value) {
      setFlash(true)
      const timer = setTimeout(() => setFlash(false), 1500)
      previous.current = value
      return () => clearTimeout(timer)
    }
    previous.current = value
  }, [value])

  return (
    <div
      data-stone={value ? 'time' : undefined}
      className={`rounded-sm px-2 py-1.5 transition-colors ${
        value ? 'bg-stone-time/[0.06]' : 'bg-transparent'
      } ${flash ? 'animate-flare' : ''}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="hud-label text-[0.6rem]">{label}</span>
        <Badge variant={value ? 'success' : 'secondary'} className="shrink-0">
          {value ? 'Captured' : 'Pending'}
        </Badge>
      </div>
      <p
        className={`text-xs ${mono ? 'hud-readout' : ''} ${
          value ? 'text-foreground/80' : 'awaiting-shimmer'
        } ${truncate ? 'truncate' : 'line-clamp-2'}`}
      >
        {value || placeholder}
      </p>
    </div>
  )
}
