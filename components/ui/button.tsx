import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // Display face, tracked-out caps and a lift on hover — buttons read as
  // hardware controls rather than web chrome.
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-display font-semibold uppercase tracking-[0.12em] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /* Hot-rod red. The primary action everywhere. */
        default:
          'sheen rounded-md bg-gradient-to-b from-primary to-[oklch(0.5_0.2_25)] text-primary-foreground shadow-[0_0_0_1px_oklch(0.7_0.2_30_/_0.4),0_10px_28px_-10px_oklch(0.585_0.215_27_/_0.85)] hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_oklch(0.75_0.2_35_/_0.6),0_16px_36px_-12px_oklch(0.585_0.215_27)]',
        /* Iron Man gold — reserved for the one CTA that outranks the rest. */
        gold: 'sheen rounded-md bg-gradient-to-b from-gold to-[oklch(0.7_0.15_72)] text-[oklch(0.16_0.03_266)] shadow-[0_0_0_1px_oklch(0.88_0.14_88_/_0.5),0_10px_28px_-10px_oklch(0.81_0.145_85_/_0.8)] hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_oklch(0.9_0.14_88),0_16px_36px_-12px_oklch(0.81_0.145_85)]',
        /* Cyan HUD control — secondary actions on instrument panels. */
        hud: 'rounded-md border border-hud/45 bg-hud/10 text-hud hover:border-hud hover:bg-hud/20 hover:shadow-[0_0_20px_-4px_oklch(0.82_0.13_197_/_0.7)]',
        destructive:
          'rounded-md bg-destructive text-primary-foreground shadow-sm hover:brightness-110',
        outline:
          'rounded-md border border-border bg-transparent hover:border-hud/60 hover:bg-hud/10 hover:text-hud',
        secondary:
          'rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/70',
        ghost: 'rounded-md hover:bg-hud/10 hover:text-hud',
        link: 'text-hud underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2 text-xs',
        sm: 'h-8 px-3 text-[0.65rem]',
        lg: 'h-12 px-8 text-sm',
        icon: 'h-9 w-9 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
