import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const calloutVariants = cva(
  'flex gap-3.5 rounded-xl border p-4 text-sm leading-relaxed text-[#37352f]',
  {
    variants: {
      variant: {
        default: 'border-[#e5e3df] bg-[#f6f5f4]',
        mint: 'border-[#bbf0cc] bg-[#d9f3e1] text-[#0f5b28]',
        lavender: 'border-[#d6b6f6] bg-[#e6e0f5] text-[#391c57]',
        peach: 'border-[#fed0af] bg-[#ffe8d4] text-[#793400]',
        sky: 'border-[#bfe0f8] bg-[#dcecfa] text-[#0a4a82]',
        yellow: 'border-[#fae88a] bg-[#fef7d6] text-[#5c4900]',
        rose: 'border-[#f8bed8] bg-[#fde0ec] text-[#a02e6d]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface CalloutProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof calloutVariants> {
  icon?: React.ReactNode
}

export function Callout({ className, variant, icon, children, ...props }: CalloutProps) {
  return (
    <div className={cn(calloutVariants({ variant }), className)} {...props}>
      {icon && <div className="shrink-0 text-lg leading-tight">{icon}</div>}
      <div className="flex-1 space-y-1">{children}</div>
    </div>
  )
}
