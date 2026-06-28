'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Bell, CheckCheck } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default function NotificationsPage() {
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ data: any[] }>('/notifications'),
  })
  const notifications = data?.data ?? []

  const readAllMutation = useMutation({
    mutationFn: () => api.put('/notifications/read-all', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const readMutation = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unread = notifications.filter((n) => !n.read)

  return (
    <AppLayout title="התראות">
      <div className="max-w-2xl space-y-4">
        {unread.length > 0 && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => readAllMutation.mutate()}>
              <CheckCheck size={14} />
              סמן הכל כנקרא
            </Button>
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="card text-center py-14">
            <Bell size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">אין התראות</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.read && readMutation.mutate(n.id)}
                className={cn(
                  'card cursor-pointer transition-colors',
                  !n.read && 'bg-primary-50 border-primary-100'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-2 h-2 rounded-full mt-1.5 shrink-0',
                    n.read ? 'bg-gray-200' : 'bg-primary'
                  )} />
                  <div className="flex-1">
                    <p className={cn('text-sm font-medium', n.read ? 'text-gray-600' : 'text-neutral-dark')}>{n.title}</p>
                    <p className="text-sm text-gray-500">{n.body}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDateTime(n.createdAt)}</p>
                  </div>
                  {n.link && (
                    <Link href={n.link} onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="text-primary">צפה</Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
