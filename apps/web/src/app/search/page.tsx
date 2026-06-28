'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Badge } from '@/components/ui/badge'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'
import Link from 'next/link'
import { FolderKanban } from 'lucide-react'

function SearchResults() {
  const sp = useSearchParams()
  const q = sp.get('q') || ''

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<{ data: any[] }>('/projects'),
  })

  const filtered = (projects?.data ?? []).filter((p) =>
    p.name.includes(q) || p.address.includes(q) || p.description?.includes(q)
  )

  return (
    <AppLayout title={`חיפוש: "${q}"`}>
      <div className="max-w-3xl space-y-6">
        {filtered.length > 0 ? (
          <div>
            <h3 className="font-semibold text-neutral-dark mb-3 flex items-center gap-2">
              <FolderKanban size={16} className="text-primary" />
              פרויקטים ({filtered.length})
            </h3>
            <div className="space-y-2">
              {filtered.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`}>
                  <div className="card hover:shadow-card-hover transition-all cursor-pointer flex items-center gap-3">
                    <FolderKanban size={18} className="text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-neutral-dark">{p.name}</p>
                      <p className="text-sm text-gray-500">{p.address}</p>
                    </div>
                    <Badge className={STATUS_COLORS[p.status as keyof typeof STATUS_COLORS]}>
                      {STATUS_LABELS[p.status]}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="card text-center py-14">
            <p className="text-gray-400">לא נמצאו תוצאות עבור "{q}"</p>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<AppLayout title="חיפוש"><div className="card text-center py-10 text-gray-400">טוען...</div></AppLayout>}>
      <SearchResults />
    </Suspense>
  )
}
