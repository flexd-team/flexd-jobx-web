import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const cardVariants = cva(
  'rounded-xl border transition-all text-[#37352f]',
  {
    variants: {
      variant: {
        default: 'border-[#e5e3df] bg-white notion-shadow-card',
        surface: 'border-[#e5e3df] bg-[#f6f5f4]',
        elevated: 'border-[#e5e3df] bg-white notion-shadow-diffuse',
        peach: 'border-[#fed0af] bg-[#ffe8d4]',
        mint: 'border-[#bbf0cc] bg-[#d9f3e1]',
        lavender: 'border-[#d6b6f6] bg-[#e6e0f5]',
        sky: 'border-[#bfe0f8] bg-[#dcecfa]',
        yellow: 'border-[#fae88a] bg-[#fef7d6]',
        yellowBold: 'border-[#f5d75e] bg-[#f9e79f]',
        navy: 'border-[#1a2a52] bg-[#0a1530] text-white',
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        default: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'default',
    },
  },
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export function Card({ className, variant, padding, ...props }: CardProps) {
  return (
    <div
      className={cn(cardVariants({ variant, padding }), className)}
      {...props}
    />
  )
}
