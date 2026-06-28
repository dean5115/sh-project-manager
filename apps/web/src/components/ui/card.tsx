import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  hoverable?: boolean
}

export function Card({ children, className, onClick, hoverable }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'card',
        hoverable && 'cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-150',
        className
      )}
    >
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color = 'primary',
  sub,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  color?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning'
  sub?: string
}) {
  const colors = {
    primary: 'bg-primary-50 text-primary',
    secondary: 'bg-secondary-50 text-secondary',
    success: 'bg-green-50 text-success',
    danger: 'bg-red-50 text-danger',
    warning: 'bg-yellow-50 text-yellow-600',
  }
  return (
    <Card className="flex items-center gap-4">
      <div className={cn('p-3 rounded-xl', colors[color])}>
        <Icon size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-neutral-dark">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </Card>
  )
}
