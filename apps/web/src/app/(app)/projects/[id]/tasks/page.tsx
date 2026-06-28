'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Plus, ArrowRight, Calendar, User } from 'lucide-react'
import { formatDate, PRIORITY_COLORS, PRIORITY_LABELS, STATUS_LABELS } from '@/lib/utils'
import Link from 'next/link'
import { useState } from 'react'
import type { Task } from '@sitepilot/types'

const COLUMNS = [
  { status: 'OPEN', label: 'פתוח', color: 'border-blue-400' },
  { status: 'IN_PROGRESS', label: 'בביצוע', color: 'border-yellow-400' },
  { status: 'PENDING_APPROVAL', label: 'ממתין לאישור', color: 'border-purple-400' },
  { status: 'DONE', label: 'הושלם', color: 'border-green-400' },
]

export default function TasksPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '' })
  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const { data } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.get<{ data: Task[] }>(`/projects/${projectId}/tasks`),
    enabled: !!projectId,
  })
  const tasks = data?.data ?? []

  const createMutation = useMutation({
    mutationFn: (d: typeof form) => api.post(`/projects/${projectId}/tasks`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', projectId] }); setOpen(false); setForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '' }) },
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/projects/${projectId}/tasks/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })

  return (
    <AppLayout title="משימות">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Link href={`/projects/${projectId}`} className="flex items-center gap-1 text-sm text-gray-400 hover:text-primary">
            <ArrowRight size={13} />
            חזרה לפרויקט
          </Link>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={14} />
            משימה חדשה
          </Button>
        </div>

        {/* Kanban */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto">
          {COLUMNS.map(({ status, label, color }) => {
            const colTasks = tasks.filter((t) => t.status === status)
            return (
              <div key={status} className={`bg-gray-50 rounded-xl border-t-4 ${color} p-3 min-h-[200px]`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-neutral-dark">{label}</span>
                  <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((task) => (
                    <div key={task.id} className="bg-white rounded-lg shadow-sm p-3 border border-gray-100">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-medium text-neutral-dark leading-tight">{task.title}</p>
                        <Badge className={PRIORITY_COLORS[task.priority]}>
                          {PRIORITY_LABELS[task.priority]}
                        </Badge>
                      </div>
                      {task.dueDate && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                          <Calendar size={11} />
                          {formatDate(task.dueDate)}
                        </div>
                      )}
                      {task.assignedTo && (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <User size={11} />
                          {(task.assignedTo as any).name ?? task.assignedTo}
                        </div>
                      )}
                      {/* Status changer */}
                      <select
                        value={task.status}
                        onChange={(e) => updateStatus.mutate({ id: task.id, status: e.target.value })}
                        className="mt-2 w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/40"
                      >
                        {COLUMNS.map((c) => (
                          <option key={c.status} value={c.status}>{c.label}</option>
                        ))}
                        <option value="CANCELLED">בוטל</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* New Task Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="משימה חדשה" size="md">
        <div className="space-y-4">
          <Input label="כותרת *" value={form.title} onChange={set('title')} placeholder="תיאור המשימה" />
          <Textarea label="פירוט" value={form.description} onChange={set('description') as any} />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="עדיפות"
              value={form.priority}
              onChange={set('priority')}
              options={[
                { value: 'LOW', label: 'נמוכה' },
                { value: 'MEDIUM', label: 'רגילה' },
                { value: 'HIGH', label: 'גבוהה' },
                { value: 'CRITICAL', label: 'קריטי' },
              ]}
            />
            <Input label="תאריך יעד" type="date" value={form.dueDate} onChange={set('dueDate')} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={() => createMutation.mutate(form)} loading={createMutation.isPending} disabled={!form.title}>
              שמור
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}
