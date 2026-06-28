'use client'
import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'
import {
  MapPin, Calendar, Edit2, BookOpen, CheckSquare,
  AlertTriangle, Image, FileText, ArrowRight, Layers, Wallet, Camera,
} from 'lucide-react'
import Link from 'next/link'
import type { Project } from '@sitepilot/types'

const TABS = [
  { key: 'journal', label: 'יומן עבודה', icon: BookOpen, href: (id: string) => `/projects/${id}/journal` },
  { key: 'tasks', label: 'משימות', icon: CheckSquare, href: (id: string) => `/projects/${id}/tasks` },
  { key: 'defects', label: 'ליקויים', icon: AlertTriangle, href: (id: string) => `/projects/${id}/defects` },
  { key: 'plans', label: 'תוכניות', icon: Layers, href: (id: string) => `/projects/${id}/plans` },
  { key: 'gallery', label: 'גלריה', icon: Image, href: (id: string) => `/projects/${id}/gallery` },
  { key: 'documents', label: 'מסמכים', icon: FileText, href: (id: string) => `/projects/${id}/documents` },
  { key: 'payments', label: 'לוח תשלומים', icon: Wallet, href: (id: string) => `/projects/${id}/payments` },
]

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get<{ data: Project & { _count: any } }>(`/projects/${id}`),
    enabled: !!id,
  })

  const project = data?.data

  if (isLoading) return <AppLayout><div className="card text-center py-10 text-gray-400">טוען...</div></AppLayout>
  if (!project) return <AppLayout><div className="card text-center py-10 text-gray-400">פרויקט לא נמצא</div></AppLayout>

  return (
    <AppLayout title={project.name}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div>
            <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-primary mb-1">
              <ArrowRight size={13} />
              פרויקטים
            </Link>
            <div className="flex items-center gap-3 mt-0.5">
              <h2 className="text-xl font-bold text-neutral-dark">{project.name}</h2>
              <Badge className={STATUS_COLORS[project.status as keyof typeof STATUS_COLORS]}>
                {STATUS_LABELS[project.status]}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/projects/${id}/field-report`}>
              <Button variant="secondary" size="sm"><Camera size={14} />דוח שטח</Button>
            </Link>
            <Link href={`/projects/${id}/edit`}>
              <Button variant="outline" size="sm"><Edit2 size={14} />עריכה</Button>
            </Link>
          </div>
        </div>

        {/* Info Card */}
        <div className="card">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin size={15} className="text-primary shrink-0" />
              <span>{project.address}</span>
            </div>
            {project.startDate && (
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar size={15} className="text-primary shrink-0" />
                <span>התחלה: {formatDate(project.startDate)}</span>
              </div>
            )}
            {project.targetDate && (
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar size={15} className="text-secondary shrink-0" />
                <span>יעד: {formatDate(project.targetDate)}</span>
              </div>
            )}
            {project.developerName && (
              <div className="text-gray-600"><span className="text-gray-400">יזם: </span>{project.developerName}</div>
            )}
            {project.mainContractor && (
              <div className="text-gray-600"><span className="text-gray-400">קבלן ראשי: </span>{project.mainContractor}</div>
            )}
          </div>
          {project.description && (
            <p className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">{project.description}</p>
          )}
        </div>

        {/* Counts */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {[
            { label: 'יומנים', count: project._count?.journals, icon: BookOpen, color: 'text-primary' },
            { label: 'משימות', count: project._count?.tasks, icon: CheckSquare, color: 'text-secondary' },
            { label: 'ליקויים', count: project._count?.defects, icon: AlertTriangle, color: 'text-danger' },
            { label: 'מסמכים', count: project._count?.documents, icon: FileText, color: 'text-gray-500' },
          ].map(({ label, count, icon: Icon, color }) => (
            <div key={label} className="card text-center py-3">
              <Icon size={20} className={`${color} mx-auto mb-1`} />
              <p className="text-xl font-bold text-neutral-dark">{count ?? 0}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {TABS.map(({ key, label, icon: Icon, href }) => (
            <Link key={key} href={href(id)}>
              <div className="card hover:shadow-card-hover hover:border-primary/30 hover:-translate-y-0.5 transition-all cursor-pointer text-center py-4">
                <Icon size={22} className="text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-neutral-dark">{label}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
