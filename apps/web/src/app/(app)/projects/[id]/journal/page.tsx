'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input, Textarea } from '@/components/ui/input'
import { Plus, ArrowRight, BookOpen, Cloud, Users, Wrench, AlertTriangle, PenLine, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { useState } from 'react'
import type { DailyJournal } from '@sitepilot/types'

export default function JournalPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [viewJournal, setViewJournal] = useState<DailyJournal | null>(null)
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    weather: '', workforce: '', workDone: '',
    equipment: '', issues: '', signedBy: '',
  })
  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const { data } = useQuery({
    queryKey: ['journals', projectId],
    queryFn: () => api.get<{ data: DailyJournal[] }>(`/projects/${projectId}/journals`),
    enabled: !!projectId,
  })
  const journals = data?.data ?? []

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post(`/projects/${projectId}/journals`, {
      ...d, workforce: d.workforce ? parseInt(d.workforce) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journals', projectId] })
      setOpen(false)
      setForm({ date: new Date().toISOString().split('T')[0], weather: '', workforce: '', workDone: '', equipment: '', issues: '', signedBy: '' })
    },
  })

  return (
    <AppLayout title="יומן עבודה">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Link href={`/projects/${projectId}`} className="flex items-center gap-1 text-sm text-gray-400 hover:text-primary">
            <ArrowRight size={13} />חזרה לפרויקט
          </Link>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={14} />יומן חדש
          </Button>
        </div>

        {journals.length === 0 ? (
          <div className="card text-center py-14">
            <BookOpen size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">אין יומנים עדיין</p>
          </div>
        ) : (
          <div className="space-y-3">
            {journals.map((j) => (
              <button key={j.id} onClick={() => setViewJournal(j)} className="w-full card text-right hover:border-primary/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="bg-primary-50 rounded-xl p-3 text-center min-w-[64px]">
                    <p className="text-primary font-bold text-lg leading-tight">
                      {new Date(j.date).getDate()}
                    </p>
                    <p className="text-primary-400 text-xs">
                      {new Date(j.date).toLocaleDateString('he-IL', { month: 'short' })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-2">
                      {j.weather && <span className="flex items-center gap-1"><Cloud size={13} />{j.weather}</span>}
                      {j.workforce && <span className="flex items-center gap-1"><Users size={13} />{j.workforce} עובדים</span>}
                    </div>
                    <p className="text-sm text-neutral-dark line-clamp-2">{j.workDone}</p>
                    {j.issues && <p className="text-sm text-danger mt-1">⚠️ {j.issues}</p>}
                    {j.signedBy && <p className="text-xs text-gray-400 mt-2">חתם: {j.signedBy}</p>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal — יצירת יומן */}
      <Modal open={open} onClose={() => setOpen(false)} title="יומן עבודה חדש" size="lg">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <Input label="תאריך *" type="date" value={form.date} onChange={set('date')} />
            <Input label="מזג אוויר" value={form.weather} onChange={set('weather')} placeholder="שמשי / גשום..." />
            <Input label="כוח אדם" type="number" value={form.workforce} onChange={set('workforce')} placeholder="מספר עובדים" />
          </div>
          <Textarea label="עבודות שבוצעו *" value={form.workDone} onChange={set('workDone') as any} placeholder="תאר את העבודות שבוצעו היום..." />
          <Textarea label="ציוד באתר" value={form.equipment} onChange={set('equipment') as any} placeholder="רשימת ציוד..." />
          <Textarea label="בעיות ועיכובים" value={form.issues} onChange={set('issues') as any} placeholder="האם היו בעיות?" />
          <Input label="חתימת מנהל" value={form.signedBy} onChange={set('signedBy')} placeholder="שם מלא" />
          <div className="flex gap-2 pt-1">
            <Button onClick={() => createMutation.mutate(form)} loading={createMutation.isPending} disabled={!form.workDone}>
              שמור יומן
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
          </div>
        </div>
      </Modal>

      {/* Modal — תצוגת יומן */}
      <Modal open={!!viewJournal} onClose={() => setViewJournal(null)} title="יומן עבודה" size="lg">
        {viewJournal && (
          <div className="space-y-5">
            {/* כותרת תאריך */}
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="bg-primary-50 rounded-xl p-3 text-center min-w-[64px]">
                <p className="text-primary font-bold text-xl leading-tight">{new Date(viewJournal.date).getDate()}</p>
                <p className="text-primary-400 text-xs">{new Date(viewJournal.date).toLocaleDateString('he-IL', { month: 'short', year: 'numeric' })}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {viewJournal.weather && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Cloud size={15} className="text-sky-400" />{viewJournal.weather}
                  </div>
                )}
                {viewJournal.workforce && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Users size={15} className="text-primary" />{viewJournal.workforce} עובדים
                  </div>
                )}
              </div>
            </div>

            {/* עבודות */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <PenLine size={12} />עבודות שבוצעו
              </p>
              <p className="text-sm text-neutral-dark whitespace-pre-wrap">{viewJournal.workDone}</p>
            </div>

            {/* ציוד */}
            {viewJournal.equipment && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Wrench size={12} />ציוד באתר
                </p>
                <p className="text-sm text-neutral-dark whitespace-pre-wrap">{viewJournal.equipment}</p>
              </div>
            )}

            {/* בעיות */}
            {viewJournal.issues && (
              <div className="bg-danger/5 border border-danger/20 rounded-xl p-3">
                <p className="text-xs font-semibold text-danger mb-1 flex items-center gap-1">
                  <AlertTriangle size={12} />בעיות ועיכובים
                </p>
                <p className="text-sm text-danger/80 whitespace-pre-wrap">{viewJournal.issues}</p>
              </div>
            )}

            {/* קבלנים */}
            {viewJournal.contractors && viewJournal.contractors.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">קבלנים באתר</p>
                <div className="flex flex-wrap gap-1.5">
                  {viewJournal.contractors.map((c, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* חתימה */}
            {viewJournal.signedBy && (
              <div className="border-t border-gray-100 pt-3 flex items-center gap-2">
                <PenLine size={13} className="text-gray-400" />
                <p className="text-sm text-gray-500">חתם: <span className="font-medium text-neutral-dark">{viewJournal.signedBy}</span></p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </AppLayout>
  )
}
