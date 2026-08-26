'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Radar, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ApprovalQueueItem } from '@/app/api/approvals/route'

const POLL_INTERVAL_MS = 3000

/** Plain fetch so the effect only ever setStates from a callback. */
async function fetchQueue(): Promise<ApprovalQueueItem[]> {
  const res = await fetch('/api/approvals', { cache: 'no-store' })
  if (!res.ok) throw new Error(`Approval queue returned ${res.status}`)
  return (await res.json()).claims
}

export function ApproveClient() {
  const [claims, setClaims] = useState<ApprovalQueueItem[] | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  /**
   * Claims whose approval count just climbed. Everyone in the room is watching
   * the same queue, so a vote landing from someone else's phone should be
   * visible here rather than silently redrawing the bar.
   */
  const [flashing, setFlashing] = useState<Set<string>>(new Set())
  const counts = useRef<Map<string, number>>(new Map())

  const applyQueue = (next: ApprovalQueueItem[]) => {
    const climbed = next.filter(
      (claim) => (counts.current.get(claim.claimId) ?? claim.approvalCount) < claim.approvalCount,
    )
    next.forEach((claim) => counts.current.set(claim.claimId, claim.approvalCount))
    setClaims(next)

    if (climbed.length > 0) {
      setFlashing(new Set(climbed.map((claim) => claim.claimId)))
      setTimeout(() => setFlashing(new Set()), 1500)
    }
  }

  // Polls the queue so every approver sees the count climb as others vote.
  useEffect(() => {
    let active = true

    const load = () =>
      fetchQueue()
        .then((next) => {
          if (active) applyQueue(next)
        })
        .catch((error) => console.error('Failed to load approval queue:', error))

    load()
    const timer = setInterval(load, POLL_INTERVAL_MS)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  const approve = async (claimId: string) => {
    setPending(claimId)
    try {
      await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId }),
      })
      applyQueue(await fetchQueue())
    } catch (error) {
      console.error('Failed to approve:', error)
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="hud-grid relative min-h-screen overflow-hidden p-4 md:p-8">
      {/* Portal idling off-screen right — the audience screen gets atmosphere too.
          The wrapper clips it, otherwise it widens the page on phones. */}
      <div className="portal-ring -right-56 top-32 h-[30rem] w-[30rem] opacity-20" />

      <div className="relative mx-auto max-w-3xl">
        <div className="animate-rise mb-10">
          <span className="hud-label">Clearance Terminal · Sector 616</span>
          <div className="mt-2 flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 ring-1 ring-primary/40">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </span>
            <h1 className="font-display text-3xl font-bold uppercase tracking-tight md:text-4xl">
              Claims Review
            </h1>
          </div>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Public likes ticker — cheer a claim from the room. This does{' '}
            <span className="text-gold">not</span> release it. The seated CIBA board of
            six is the grant.
          </p>
        </div>

        {claims === null && (
          <div className="flex flex-col items-center gap-5 py-20">
            <div className="arc-reactor h-16 w-16" />
            <p className="hud-label animate-blink">Syncing queue…</p>
          </div>
        )}

        {claims?.length === 0 && (
          <Card className="hud-panel animate-rise rounded-none border-transparent">
            <CardHeader className="items-center py-14 text-center">
              <span className="relative mb-5 grid h-16 w-16 place-items-center">
                {/* Idle radar sweep while the queue is empty. */}
                <span className="absolute inset-0 rounded-full border border-dashed border-hud/40 [animation:spin_8s_linear_infinite]" />
                <Radar className="h-7 w-7 text-hud/70" />
              </span>
              <CardTitle className="uppercase">No claims waiting</CardTitle>
              <CardDescription className="max-w-sm">
                Once someone submits a claim from the chat assistant, it appears here within a
                few seconds.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="space-y-5">
          {claims?.map((claim, index) => {
            const isApproved = claim.status === 'approved'
            const remaining = claim.requiredApprovals - claim.approvalCount
            const progress = (claim.approvalCount / claim.totalApprovers) * 100

            return (
              <Card
                key={claim.claimId}
                data-stone={isApproved ? 'time' : 'mind'}
                className={`hud-panel animate-rise rounded-none border-transparent transition-shadow duration-500 ${
                  isApproved ? 'glow-stone' : ''
                } ${flashing.has(claim.claimId) ? 'animate-flare' : ''}`}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <span className="absolute inset-x-0 top-0 h-0.5 bg-[var(--stone)]" />

                <CardHeader className="pb-3 pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="hud-label text-[0.6rem] text-muted-foreground">
                        Policy
                      </span>
                      <CardTitle className="hud-readout mt-0.5 text-lg text-foreground">
                        {claim.policyId}
                      </CardTitle>
                      <CardDescription className="mt-1.5">
                        {claim.incidentDescription ?? 'No description provided'}
                      </CardDescription>
                    </div>
                    <Badge variant="stone" className="shrink-0">
                      {isApproved ? (
                        'Approved'
                      ) : (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--stone)] animate-blink" />
                          Awaiting
                        </>
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <Separator />

                <CardContent className="space-y-5 pt-5">
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="hud-label text-[0.6rem]">Location</dt>
                      <dd className="mt-1 text-sm text-foreground/85">
                        {claim.incidentLocation ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="hud-label text-[0.6rem]">Damage</dt>
                      <dd className="mt-1 text-sm text-foreground/85">
                        {claim.damageExtent ?? '—'}
                      </dd>
                    </div>
                  </dl>

                  <div>
                    <div className="mb-1.5 flex justify-between">
                      <span className="hud-readout text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">
                        Likes
                      </span>
                      <span className="hud-readout text-[0.7rem] text-[var(--stone)]">
                        {claim.approvalCount}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="energy-fill h-full rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                    {!isApproved && remaining > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Atmosphere only — CIBA yeses on the host board release the claim.
                      </p>
                    )}
                  </div>

                  {isApproved ? (
                    <div className="flex items-center gap-2 text-sm text-stone-time">
                      <CheckCircle2 className="h-4 w-4" />
                      Claim approved by the CIBA board
                    </div>
                  ) : claim.alreadyApproved ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-hud" />
                      You liked this claim
                    </div>
                  ) : (
                    <Button
                      onClick={() => void approve(claim.claimId)}
                      disabled={pending === claim.claimId}
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      {pending === claim.claimId ? 'Sending…' : 'Cheer this claim'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
