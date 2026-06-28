'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { StatCard } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FolderKanban, CheckSquare, AlertTriangle, BookOpen, Plus, ArrowLeft } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { formatDate, STATUS_LABELS, STATUS_COLORS } from '@/lib/utils'
import Link from 'next/link'
import type { Project, Task, Defect } from '@sitepilot/types'

export default function DashboardPage() {
  const { user } = useAuthStore()

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<{ data: (Project & { _count: any })[] }>('/projects'),
  })

  const active = projects?.data?.filter((p) => p.status === 'ACTIVE') ?? []

  return (
    <AppLayout title="דשבורד">
      <div className="space-y-6">
        {/* Welcome */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-dark">שלום, {user?.name?.split(' ')[0]} 👋</h2>
            <p className="text-gray-500 text-sm mt-0.5">הנה סיכום המצב היום</p>
          </div>
          <Link href="/projects/new">
            <Button size="sm">
              <Plus size={15} />
              פרויקט חדש
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="פרויקטים פעילים"
            value={active.length}
            icon={FolderKanban}
            color="primary"
          />
          <StatCard
            label="סה״כ פרויקטים"
            value={projects?.data?.length ?? 0}
            icon={FolderKanban}
            color="secondary"
          />
          <StatCard
            label="משימות פתוחות"
            value={active.reduce((s, p) => s + (p._count?.tasks ?? 0), 0)}
            icon={CheckSquare}
            color="warning"
          />
          <StatCard
            label="ליקויים פתוחים"
            value={active.reduce((s, p) => s + (p._count?.defects ?? 0), 0)}
            icon={AlertTriangle}
            color="danger"
          />
        </div>

        {/* Active Projects */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-neutral-dark">פרויקטים פעילים</h3>
            <Link href="/projects" className="text-sm text-primary hover:underline flex items-center gap-1">
              כל הפרויקטים <ArrowLeft size={13} />
            </Link>
          </div>

          {active.length === 0 ? (
            <div className="card text-center py-12">
              <FolderKanban size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">אין פרויקטים פעילים</p>
              <Link href="/projects/new">
                <Button size="sm" className="mt-3">צור פרויקט ראשון</Button>
              </Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {active.slice(0, 6).map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-150 cursor-pointer">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-semibold text-neutral-dark text-sm leading-tight">{project.name}</h4>
                      <Badge className={STATUS_COLORS[project.status as keyof typeof STATUS_COLORS]}>
                        {STATUS_LABELS[project.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mb-3 truncate">{project.address}</p>
                    <div className="flex gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <CheckSquare size={12} />
                        {project._count?.tasks ?? 0} משימות
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertTriangle size={12} />
                        {project._count?.defects ?? 0} ליקויים
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen size={12} />
                        {project._count?.journals ?? 0} יומנים
                      </span>
                    </div>
                    {project.targetDate && (
                      <p className="text-xs text-gray-400 mt-2">יעד: {formatDate(project.targetDate)}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
