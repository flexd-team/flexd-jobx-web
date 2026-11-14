import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        data-slot="input"
        className={cn(
          'flex h-10 w-full rounded-md border border-[#c8c4be] bg-white px-3 py-2 text-sm text-[#37352f] placeholder:text-[#a4a097] focus-visible:outline-none focus-visible:border-[#5645d4] focus-visible:ring-1 focus-visible:ring-[#5645d4] disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
          className,
        )}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'
