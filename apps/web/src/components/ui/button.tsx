'use client'
import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-primary text-white hover:bg-primary-600 shadow-sm': variant === 'primary',
            'bg-secondary text-white hover:bg-secondary-600 shadow-sm': variant === 'secondary',
            'bg-transparent text-neutral-dark hover:bg-gray-100': variant === 'ghost',
            'bg-danger text-white hover:bg-red-600 shadow-sm': variant === 'danger',
            'border border-gray-300 bg-white text-neutral-dark hover:bg-gray-50': variant === 'outline',
          },
          {
            'px-3 py-1.5 text-sm min-h-[32px]': size === 'sm',
            'px-4 py-2.5 text-sm min-h-[40px]': size === 'md',
            'px-5 py-3 text-base min-h-[48px]': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
