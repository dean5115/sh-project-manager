'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ArrowRight, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const [form, setForm] = useState<any>(null)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get<{ data: any }>(`/projects/${id}`),
  })

  useEffect(() => {
    if (data?.data) {
      const p = data.data
      setForm({
        name: p.name || '',
        address: p.address || '',
        description: p.description || '',
        developerName: p.developerName || '',
        mainContractor: p.mainContractor || '',
        startDate: p.startDate ? p.startDate.split('T')[0] : '',
        targetDate: p.targetDate ? p.targetDate.split('T')[0] : '',
        status: p.status || 'ACTIVE',
      })
    }
  }, [data])

  const set = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.value }))

  const mutation = useMutation({
    mutationFn: (d: any) => api.put(`/projects/${id}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      router.push(`/projects/${id}`)
    },
    onError: (err: any) => setError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      router.push('/projects')
    },
    onError: (err: any) => setError(err.message),
  })

  if (!form) return <AppLayout><div className="card text-center py-10 text-gray-400">טוען...</div></AppLayout>

  return (
    <AppLayout title="עריכת פרויקט">
      <div className="max-w-2xl">
        <Link href={`/projects/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary mb-5">
          <ArrowRight size={14} />
          חזרה לפרויקט
        </Link>

        <div className="card space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-danger text-sm rounded-lg px-3 py-2">{error}</div>}

          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="שם הפרויקט *" value={form.name} onChange={set('name')} required />
            <Input label="כתובת *" value={form.address} onChange={set('address')} required />
          </div>
          <Textarea label="תיאור" value={form.description} onChange={set('description') as any} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="שם היזם" value={form.developerName} onChange={set('developerName')} />
            <Input label="קבלן ראשי" value={form.mainContractor} onChange={set('mainContractor')} />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Input label="תאריך התחלה" type="date" value={form.startDate} onChange={set('startDate')} />
            <Input label="תאריך יעד" type="date" value={form.targetDate} onChange={set('targetDate')} />
            <Select
              label="סטטוס"
              value={form.status}
              onChange={set('status')}
              options={[
                { value: 'TENDER', label: 'מכרז' }, { value: 'PERMIT', label: 'היתר' },
                { value: 'PLANNING', label: 'תכנון' }, { value: 'ACTIVE', label: 'פעיל' },
                { value: 'ON_HOLD', label: 'מושהה' }, { value: 'COMPLETED', label: 'הושלם' },
                { value: 'CANCELLED', label: 'בוטל' },
              ]}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={() => mutation.mutate(form)} loading={mutation.isPending}>שמור שינויים</Button>
            <Link href={`/projects/${id}`}><Button variant="outline">ביטול</Button></Link>
          </div>
        </div>

        {/* אזור מסוכן */}
        <div className="card mt-5 border-red-100 bg-red-50/30">
          <p className="font-semibold text-danger text-sm mb-1">מחיקת פרויקט</p>
          <p className="text-sm text-gray-500 mb-3">
            פעולה זו תמחק את הפרויקט וכל הנתונים המשויכים אליו (יומנים, משימות, ליקויים, מסמכים) לצמיתות. לא ניתן לבטל.
          </p>
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} />
            מחק פרויקט
          </Button>
        </div>
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="מחיקת פרויקט" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            למחוק לצמיתות את <strong>{form.name}</strong> וכל הנתונים שלו (יומנים, משימות, ליקויים, מסמכים, דוחות)?
            <br />פעולה זו <strong>לא ניתנת לביטול</strong>.
          </p>
          {deleteMutation.isError && (
            <div className="bg-red-50 border border-red-200 text-danger rounded-lg px-3 py-2 text-sm">
              {(deleteMutation.error as any)?.message}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => deleteMutation.mutate()} loading={deleteMutation.isPending}>
              כן, מחק לצמיתות
            </Button>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>ביטול</Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}
