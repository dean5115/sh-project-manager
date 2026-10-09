'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Badge } from '@/components/ui/badge'
import { STATUS_COLORS, STATUS_LABELS, CATEGORY_LABELS } from '@/lib/utils'
import { searchStandards } from '@/lib/standards-search'
import Link from 'next/link'
import { FolderKanban, BookMarked } from 'lucide-react'
import type { Standard } from '@sitepilot/types'

const SOURCE_LABELS: Record<string, string> = { REGULATION: 'תקנות התכנון והבניה', HALAT: 'הל"ת', STANDARD: 'תקן' }

function SearchResults() {
  const sp = useSearchParams()
  const q = sp.get('q') || ''

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<{ data: any[] }>('/projects'),
  })

  const filtered = (projects?.data ?? []).filter((p) =>
    p.name?.includes(q) || p.address?.includes(q) || p.description?.includes(q)
  )

  // החיפוש העליון מוצא גם תקנים — למשל "1920"
  const { data: standardsData } = useQuery({
    queryKey: ['standards'],
    queryFn: () => api.get<{ data: Standard[] }>('/standards'),
  })
  const standards = searchStandards(standardsData?.data ?? [], q)

  return (
    <AppLayout title={`חיפוש: "${q}"`}>
      <div className="max-w-3xl space-y-6">
        {standards.length > 0 && (
          <div>
            <h3 className="font-semibold text-neutral-dark mb-3 flex items-center gap-2">
              <BookMarked size={16} className="text-primary" />
              תקנים ({standards.length})
            </h3>
            <div className="space-y-2">
              {standards.slice(0, 20).map((s) => (
                <Link key={s.id} href={`/settings/standards?q=${encodeURIComponent(q)}`}>
                  <div className="card hover:shadow-card-hover transition-all cursor-pointer flex items-center gap-3">
                    <BookMarked size={18} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-dark">{s.code}</p>
                      {s.description && <p className="text-sm text-gray-500 truncate">{s.description}</p>}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {s.category ? CATEGORY_LABELS[s.category] : SOURCE_LABELS[s.sourceType]}
                    </span>
                  </div>
                </Link>
              ))}
              {standards.length > 20 && (
                <Link href={`/settings/standards?q=${encodeURIComponent(q)}`} className="block text-sm text-primary hover:underline">
                  הצג את כל {standards.length} התקנים בספריית התקנים
                </Link>
              )}
            </div>
          </div>
        )}

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
        ) : standards.length === 0 ? (
          <div className="card text-center py-14">
            <p className="text-gray-400">לא נמצאו תוצאות עבור "{q}"</p>
          </div>
        ) : null}
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
