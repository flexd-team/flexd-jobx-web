import * as React from 'react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5645d4] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
  {
    variants: {
      variant: {
        primary: 'bg-[#5645d4] text-white hover:bg-[#4534b3] active:bg-[#3a2a99] shadow-sm',
        secondary: 'border border-[#c8c4be] bg-transparent text-[#37352f] hover:bg-[#f6f5f4] active:bg-[#ede9e4]',
        dark: 'bg-[#1a1a1a] text-white hover:bg-[#37352f] active:bg-[#000000]',
        outline: 'border border-[#e5e3df] bg-white text-[#37352f] hover:bg-[#f6f5f4]',
        ghost: 'bg-transparent text-[#37352f] hover:bg-[#f6f5f4]',
        danger: 'bg-[#e03131] text-white hover:bg-[#c92a2a]',
        link: 'bg-transparent text-[#0075de] underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base font-semibold',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : 'button'
    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
