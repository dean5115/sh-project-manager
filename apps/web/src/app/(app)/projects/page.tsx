'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Plus, Search, FolderKanban, MapPin, Calendar } from 'lucide-react'
import { formatDate, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'
import Link from 'next/link'
import { useState } from 'react'
import type { Project } from '@sitepilot/types'

const STATUS_OPTIONS = ['', 'PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']
const STATUS_OPT_LABELS: Record<string, string> = {
  '': 'כל הסטטוסים', PLANNING: 'תכנון', ACTIVE: 'פעיל',
  ON_HOLD: 'מושהה', COMPLETED: 'הושלם', CANCELLED: 'בוטל',
}

export default function ProjectsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<{ data: (Project & { _count: any })[] }>('/projects'),
  })

  const filtered = (data?.data ?? []).filter((p) => {
    const matchSearch = p.name.includes(search) || p.address.includes(search)
    const matchStatus = !statusFilter || p.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <AppLayout title="פרויקטים">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex gap-2 flex-1 min-w-0">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חיפוש פרויקט..."
                className="w-full border border-gray-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_OPT_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <Link href="/projects/new">
            <Button>
              <Plus size={15} />
              פרויקט חדש
            </Button>
          </Link>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="card text-center py-10 text-gray-400">טוען...</div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-16">
            <FolderKanban size={44} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">לא נמצאו פרויקטים</p>
            <Link href="/projects/new">
              <Button size="sm" className="mt-4">צור פרויקט</Button>
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <div className="card hover:shadow-card-hover hover:-translate-y-0.5 transition-all cursor-pointer h-full">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-neutral-dark leading-tight">{project.name}</h3>
                    <Badge className={STATUS_COLORS[project.status as keyof typeof STATUS_COLORS]}>
                      {STATUS_LABELS[project.status]}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-sm text-gray-500 mb-4">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={13} className="text-gray-400 shrink-0" />
                      <span className="truncate">{project.address}</span>
                    </div>
                    {project.targetDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-gray-400 shrink-0" />
                        <span>יעד: {formatDate(project.targetDate)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 text-xs text-gray-400 pt-3 border-t border-gray-50">
                    <span>{project._count?.tasks ?? 0} משימות</span>
                    <span>{project._count?.defects ?? 0} ליקויים</span>
                    <span>{project._count?.journals ?? 0} יומנים</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
