import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}

export function Badge({ children, className, variant = 'default' }: BadgeProps) {
  return (
    <span className={cn(
      'badge',
      {
        'bg-blue-100 text-blue-700': variant === 'default' || variant === 'info',
        'bg-green-100 text-green-700': variant === 'success',
        'bg-yellow-100 text-yellow-700': variant === 'warning',
        'bg-red-100 text-red-700': variant === 'danger',
        'bg-gray-100 text-gray-600': variant === 'neutral',
      },
      className
    )}>
      {children}
    </span>
  )
}
