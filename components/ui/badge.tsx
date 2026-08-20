import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  // Badges are status readouts, so they use the mono face and tabular figures.
  'inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] tabular-nums transition-colors',
  {
    variants: {
      variant: {
        default: 'border-primary/50 bg-primary/15 text-[oklch(0.78_0.16_30)]',
        /* Picks up whatever --stone is in scope — see [data-stone] in globals. */
        stone:
          'border-[color-mix(in_oklch,var(--stone)_45%,transparent)] bg-[color-mix(in_oklch,var(--stone)_14%,transparent)] text-[var(--stone)]',
        hud: 'border-hud/45 bg-hud/10 text-hud',
        gold: 'border-gold/45 bg-gold/12 text-gold',
        success:
          'border-stone-time/50 bg-stone-time/12 text-stone-time',
        warning: 'border-gold/50 bg-gold/10 text-gold',
        secondary: 'border-border bg-secondary text-muted-foreground',
        destructive: 'border-destructive/50 bg-destructive/15 text-destructive',
        outline: 'border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
