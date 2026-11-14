import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors select-none',
  {
    variants: {
      variant: {
        default: 'bg-[#f6f5f4] text-[#37352f] border border-[#e5e3df]',
        purple: 'bg-[#5645d4] text-white',
        lavender: 'bg-[#e6e0f5] text-[#391c57] border border-[#d6b6f6]',
        peach: 'bg-[#ffe8d4] text-[#793400] border border-[#fed0af]',
        mint: 'bg-[#d9f3e1] text-[#0f5b28] border border-[#bbf0cc]',
        sky: 'bg-[#dcecfa] text-[#0a4a82] border border-[#bfe0f8]',
        rose: 'bg-[#fde0ec] text-[#a02e6d] border border-[#f8bed8]',
        yellow: 'bg-[#fef7d6] text-[#6d5607] border border-[#fae88a]',
        yellowBold: 'bg-[#f9e79f] text-[#4a3900] font-semibold',
        dark: 'bg-[#1a1a1a] text-white',
        outline: 'border border-[#c8c4be] text-[#5d5b54] bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}
