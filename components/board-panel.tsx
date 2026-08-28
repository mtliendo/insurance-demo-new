import { CheckCircle2, Mail, MinusCircle, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CibaBoardMember, CibaBoardSnapshot } from '@/lib/types'

const STATUS_STONE: Record<CibaBoardMember['status'], string> = {
  pending: 'mind',
  approved: 'time',
  denied: 'reality',
  error: 'power',
}

export function BoardPanel({
  board,
  compact,
}: {
  board: CibaBoardSnapshot
  compact?: boolean
}) {
  const remaining = Math.max(0, board.requiredApprovals - board.approvedCount)
  const progress = (board.approvedCount / board.requiredApprovals) * 100

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex justify-between">
          <span className="hud-readout text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">
            CIBA board
          </span>
          <span className="hud-readout text-[0.7rem] text-[var(--stone)]">
            {board.approvedCount}/{board.requiredApprovals} yeses
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="energy-fill h-full rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {board.started
            ? remaining > 0
              ? `${remaining} more CIBA approval${remaining > 1 ? 's' : ''} to release`
              : 'Threshold met — releasing…'
            : 'Emails go out from the operator console when the claim is submitted.'}
        </p>
      </div>

      <ul className={`grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {board.members.length === 0 && (
          <li className="text-xs text-muted-foreground">No board seated yet.</li>
        )}
        {board.members.map((member) => (
          <BoardSeat key={member.sub} member={member} />
        ))}
      </ul>
    </div>
  )
}

export function BoardSeat({ member }: { member: CibaBoardMember }) {
  return (
    <li
      data-stone={STATUS_STONE[member.status]}
      className="flex items-center justify-between gap-3 rounded-sm border border-[color-mix(in_oklch,var(--stone)_35%,transparent)] bg-[color-mix(in_oklch,var(--stone)_08%,transparent)] px-3 py-2"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
        <p className="hud-readout truncate text-[0.65rem] text-muted-foreground">{member.email}</p>
      </div>
      <StatusBadge status={member.status} />
    </li>
  )
}

function StatusBadge({ status }: { status: CibaBoardMember['status'] }) {
  if (status === 'approved') {
    return (
      <Badge variant="success" className="shrink-0">
        <CheckCircle2 className="h-3 w-3" />
        Approved
      </Badge>
    )
  }
  if (status === 'denied') {
    return (
      <Badge variant="destructive" className="shrink-0">
        <MinusCircle className="h-3 w-3" />
        Denied
      </Badge>
    )
  }
  if (status === 'error') {
    return (
      <Badge variant="destructive" className="shrink-0">
        <TriangleAlert className="h-3 w-3" />
        Error
      </Badge>
    )
  }
  return (
    <Badge variant="warning" className="shrink-0">
      <Mail className="h-3 w-3" />
      Pending
    </Badge>
  )
}
