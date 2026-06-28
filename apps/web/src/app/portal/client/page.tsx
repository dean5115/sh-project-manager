'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HardHat, LogOut, Download, FolderKanban } from 'lucide-react'
import { formatDate, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'
import Link from 'next/link'

export default function ClientPortalPage() {
  const { user, organization, logout, isAuthenticated } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/login')
  }, [isAuthenticated, router])

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<{ data: any[] }>('/projects'),
  })

  return (
    <div className="min-h-screen bg-gray-50 rtl">
      <header className="bg-primary text-white px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-secondary rounded-lg flex items-center justify-center">
            <HardHat size={18} />
          </div>
          <div>
            <p className="font-bold text-sm">SH - Project Manager</p>
            <p className="text-primary-200 text-xs">{organization?.name}</p>
          </div>
        </div>
        <button onClick={() => { logout(); router.replace('/login') }} className="flex items-center gap-1 text-primary-200 text-sm">
          <LogOut size={15} />
          יציאה
        </button>
      </header>

      <div className="p-4 max-w-2xl mx-auto">
        <h1 className="text-lg font-bold text-neutral-dark mb-1">שלום, {user?.name?.split(' ')[0]}</h1>
        <p className="text-sm text-gray-500 mb-4">פורטל לקוח — צפייה בפרויקטים</p>

        {(projects?.data ?? []).length === 0 ? (
          <div className="card text-center py-10">
            <FolderKanban size={36} className="text-gray-200 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">אין פרויקטים לצפייה</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(projects?.data ?? []).map((project: any) => (
              <ClientProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ClientProjectCard({ project }: { project: any }) {
  const { data: reports } = useQuery({
    queryKey: ['reports', project.id],
    queryFn: () => api.get<{ data: any[] }>(`/projects/${project.id}/reports`),
  })

  const approvedReports = (reports?.data ?? []).filter((r) => r.pdfUrl)

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-neutral-dark">{project.name}</h3>
        <Badge className={STATUS_COLORS[project.status as keyof typeof STATUS_COLORS]}>
          {STATUS_LABELS[project.status]}
        </Badge>
      </div>
      <p className="text-sm text-gray-500 mb-3">{project.address}</p>

      {project.targetDate && (
        <p className="text-xs text-gray-400 mb-3">תאריך יעד: {formatDate(project.targetDate)}</p>
      )}

      {approvedReports.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">דוחות זמינים:</p>
          <div className="space-y-1">
            {approvedReports.map((r) => (
              <a key={r.id} href={r.pdfUrl} download target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Download size={13} />
                {r.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
