'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Confetti from 'react-confetti'
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
import type { ClaimSnapshot } from '@/lib/types'
import { REQUIRED_APPROVALS, TOTAL_APPROVERS } from '@/lib/types'

const POLL_INTERVAL_MS = 2000

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Starting your claim…</div>
      </div>
    )
  }

  const { claim, messages, approvalCount } = snapshot
  const remaining = REQUIRED_APPROVALS - approvalCount

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      {showApprovalModal && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle
          numberOfPieces={500}
        />
      )}

      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-green-600">Claim Approved!</CardTitle>
              <CardDescription className="text-base">
                Great news! Your claim has been approved by our processing team.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="text-6xl">🎉</div>
              <p className="text-center text-muted-foreground">
                We&apos;ve processed your superhero insurance claim and it has been approved.
                You will receive further details via email.
              </p>
              <Button
                onClick={() => setShowApprovalModal(false)}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">File a Claim</h1>
        <p className="text-muted-foreground mb-6">
          Welcome, {userLabel}. Chat with our AI assistant to file your superhero-related claim.
        </p>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Chat */}
          <Card className="flex-1 flex flex-col h-[600px]">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Claims Assistant</CardTitle>
              <CardDescription>
                Describe your incident and I&apos;ll help you file your claim
              </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 flex flex-col p-4 overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <p className="text-sm text-muted-foreground">Thinking…</p>
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
                  placeholder="Type your message..."
                  className="flex-1 min-h-[44px] max-h-[120px] px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isSending}
                  rows={1}
                />
                <Button
                  onClick={() => void sendMessage()}
                  disabled={isSending || !currentMessage.trim()}
                  className="self-end"
                >
                  {isSending ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Claim details sidebar */}
          <Card className="lg:w-80 h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Claim Details</CardTitle>
              <CardDescription>Information collected for your claim</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="p-4 space-y-4">
              <Field label="User ID" value={claim.userId} placeholder="Waiting…" truncate />
              <Separator />
              <Field label="Policy Number" value={claim.policyId} placeholder="Waiting…" />
              <Separator />
              <Field
                label="Incident"
                value={claim.incidentDescription}
                placeholder="Describe what happened…"
              />
              <Separator />
              <Field
                label="Location"
                value={claim.incidentLocation}
                placeholder="Where did it happen?"
              />
              <Separator />
              <Field
                label="Damage Extent"
                value={claim.damageExtent}
                placeholder="How severe is the damage?"
              />
              <Separator />

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <Badge
                    variant={
                      claim.status === 'approved'
                        ? 'default'
                        : claim.status === 'denied'
                          ? 'destructive'
                          : claim.status === 'awaiting_approval'
                            ? 'outline'
                            : 'secondary'
                    }
                    className={
                      claim.status === 'approved'
                        ? 'bg-green-500 hover:bg-green-600'
                        : claim.status === 'awaiting_approval'
                          ? 'border-yellow-500 text-yellow-600'
                          : ''
                    }
                  >
                    {claim.status === 'awaiting_approval'
                      ? `Awaiting Approval (${approvalCount}/${TOTAL_APPROVERS})`
                      : claim.status === 'approved'
                        ? 'Approved'
                        : claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                  </Badge>
                </div>

                {claim.status === 'awaiting_approval' && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Approvals received</span>
                      <span>
                        {approvalCount}/{TOTAL_APPROVERS}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(approvalCount / TOTAL_APPROVERS) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {remaining > 0
                        ? `${remaining} more approval${remaining > 1 ? 's' : ''} needed`
                        : 'Claim approved!'}
                    </p>
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

function Field({
  label,
  value,
  placeholder,
  truncate,
}: {
  label: string
  value: string | null
  placeholder: string
  truncate?: boolean
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Badge
          variant={value ? 'default' : 'secondary'}
          className={value ? 'bg-green-500 hover:bg-green-600' : ''}
        >
          {value ? 'Captured' : 'Pending'}
        </Badge>
      </div>
      <p
        className={`text-xs text-muted-foreground ${truncate ? 'truncate' : 'line-clamp-2'}`}
      >
        {value || placeholder}
      </p>
    </div>
  )
}
