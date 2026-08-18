'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
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

  // Polls the queue so every approver sees the count climb as others vote.
  useEffect(() => {
    let active = true

    const load = () =>
      fetchQueue()
        .then((next) => {
          if (active) setClaims(next)
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
      setClaims(await fetchQueue())
    } catch (error) {
      console.error('Failed to approve:', error)
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <h1 className="text-3xl md:text-4xl font-bold">Claims Review</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          You&apos;re on the Hero Shield claims processing team. Review each submitted claim and
          approve it if it looks legitimate — a claim needs three approvals to go through.
        </p>

        {claims === null && <p className="text-muted-foreground">Loading claims…</p>}

        {claims?.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">No claims waiting</CardTitle>
              <CardDescription>
                Once someone submits a claim from the chat assistant, it will appear here.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="space-y-4">
          {claims?.map((claim) => {
            const isApproved = claim.status === 'approved'
            const remaining = claim.requiredApprovals - claim.approvalCount

            return (
              <Card key={claim.claimId}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">{claim.policyId}</CardTitle>
                      <CardDescription>
                        {claim.incidentDescription ?? 'No description provided'}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={isApproved ? 'default' : 'outline'}
                      className={
                        isApproved
                          ? 'bg-green-500 hover:bg-green-600 shrink-0'
                          : 'border-yellow-500 text-yellow-600 shrink-0'
                      }
                    >
                      {isApproved ? 'Approved' : 'Awaiting approval'}
                    </Badge>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="pt-4 space-y-4">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="font-medium">Location</dt>
                      <dd className="text-muted-foreground">{claim.incidentLocation ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-medium">Damage</dt>
                      <dd className="text-muted-foreground">{claim.damageExtent ?? '—'}</dd>
                    </div>
                  </dl>

                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Approvals</span>
                      <span>
                        {claim.approvalCount}/{claim.totalApprovers}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          isApproved ? 'bg-green-500' : 'bg-yellow-500'
                        }`}
                        style={{
                          width: `${(claim.approvalCount / claim.totalApprovers) * 100}%`,
                        }}
                      />
                    </div>
                    {!isApproved && remaining > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {remaining} more approval{remaining > 1 ? 's' : ''} needed
                      </p>
                    )}
                  </div>

                  {isApproved ? (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      Claim approved
                    </div>
                  ) : claim.alreadyApproved ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4" />
                      You approved this claim
                    </div>
                  ) : (
                    <Button
                      onClick={() => void approve(claim.claimId)}
                      disabled={pending === claim.claimId}
                      className="w-full sm:w-auto"
                    >
                      {pending === claim.claimId ? 'Approving…' : 'Approve claim'}
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
