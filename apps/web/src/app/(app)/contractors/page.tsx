'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input, Textarea } from '@/components/ui/input'
import { Plus, HardHat, Phone, Mail, Wrench, FolderKanban } from 'lucide-react'
import { useState } from 'react'
import type { Contractor, Project } from '@sitepilot/types'

export default function ContractorsPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignContractor, setAssignContractor] = useState<any>(null)
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [form, setForm] = useState({ name: '', trade: '', contactName: '', phone: '', email: '', notes: '' })
  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const { data } = useQuery({
    queryKey: ['contractors'],
    queryFn: () => api.get<{ data: (Contractor & { _count: any; projects: { id: string; name: string }[] })[] }>('/contractors'),
  })
  const contractors = data?.data ?? []

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<{ data: Project[] }>('/projects'),
  })
  const projects = projectsData?.data ?? []

  const createMutation = useMutation({
    mutationFn: (d: typeof form) => api.post('/contractors', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contractors'] })
      setOpen(false)
      setForm({ name: '', trade: '', contactName: '', phone: '', email: '', notes: '' })
    },
  })

  const assignMutation = useMutation({
    mutationFn: ({ id, projectIds }: { id: string; projectIds: string[] }) =>
      api.put(`/contractors/${id}/projects`, { projectIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contractors'] })
      setAssignOpen(false)
    },
  })

  function openAssign(c: any) {
    setAssignContractor(c)
    setSelectedProjects((c.projects ?? []).map((p: any) => p.id))
    setAssignOpen(true)
  }

  function toggleProject(id: string) {
    setSelectedProjects((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  return (
    <AppLayout title="ניהול קבלנים">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={14} />
            קבלן חדש
          </Button>
        </div>

        {contractors.length === 0 ? (
          <div className="card text-center py-14">
            <HardHat size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">אין קבלנים עדיין</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {contractors.map((c) => (
              <div key={c.id} className="card">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center shrink-0">
                    <HardHat size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-neutral-dark">{c.name}</h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Wrench size={12} />{c.trade}
                    </p>
                  </div>
                </div>

                {c.contactName && <p className="text-sm text-gray-600 mb-1">{c.contactName}</p>}
                <div className="space-y-1 mb-3">
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary">
                      <Phone size={13} />{c.phone}
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary">
                      <Mail size={13} />{c.email}
                    </a>
                  )}
                </div>

                {/* פרויקטים משויכים */}
                {(c.projects ?? []).length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-1">פרויקטים:</p>
                    <div className="flex flex-wrap gap-1">
                      {c.projects.map((p: any) => (
                        <span key={p.id} className="text-xs bg-primary-50 text-primary px-2 py-0.5 rounded-full">
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 text-xs text-gray-400 mt-2 pt-3 border-t border-gray-50 items-center">
                  <span>{c._count?.tasks ?? 0} משימות</span>
                  <span>{c._count?.defects ?? 0} ליקויים</span>
                  <button
                    onClick={() => openAssign(c)}
                    className="mr-auto flex items-center gap-1 text-primary hover:underline text-xs"
                  >
                    <FolderKanban size={12} />
                    שייך לפרויקט
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal — קבלן חדש */}
      <Modal open={open} onClose={() => setOpen(false)} title="קבלן חדש" size="md">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="שם הקבלן *" value={form.name} onChange={set('name')} placeholder="שם חברה" />
            <Input label="תחום עבודה *" value={form.trade} onChange={set('trade')} placeholder="חשמל / אינסטלציה..." />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="איש קשר" value={form.contactName} onChange={set('contactName')} />
            <Input label="טלפון" type="tel" value={form.phone} onChange={set('phone')} />
          </div>
          <Input label="אימייל (לכניסת קבלן)" type="email" value={form.email} onChange={set('email')}
            placeholder="contractor@example.com" />
          <Textarea label="הערות" value={form.notes} onChange={set('notes') as any} />
          <div className="flex gap-2">
            <Button onClick={() => createMutation.mutate(form)} loading={createMutation.isPending} disabled={!form.name || !form.trade}>
              שמור קבלן
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
          </div>
        </div>
      </Modal>

      {/* Modal — שיוך לפרויקטים */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title={`שיוך "${assignContractor?.name}" לפרויקטים`} size="sm">
        <div className="space-y-3">
          {projects.length === 0 && <p className="text-gray-500 text-sm text-center py-4">אין פרויקטים</p>}
          {projects.map((p) => (
            <label key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-primary/30 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={selectedProjects.includes(p.id)}
                onChange={() => toggleProject(p.id)}
                className="w-4 h-4 accent-primary"
              />
              <div>
                <p className="text-sm font-medium text-neutral-dark">{p.name}</p>
                <p className="text-xs text-gray-400">{p.address}</p>
              </div>
            </label>
          ))}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => assignMutation.mutate({ id: assignContractor?.id, projectIds: selectedProjects })}
              loading={assignMutation.isPending}
            >
              שמור שיוך
            </Button>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>ביטול</Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}
