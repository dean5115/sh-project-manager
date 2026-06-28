'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function NewProjectPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: '', address: '', description: '',
    developerName: '', mainContractor: '',
    startDate: '', targetDate: '',
    status: 'ACTIVE',
  })
  const [error, setError] = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const mutation = useMutation({
    mutationFn: (data: typeof form) => api.post<{ data: any }>('/projects', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      router.push(`/projects/${res.data.id}`)
    },
    onError: (err: any) => setError(err.message),
  })

  return (
    <AppLayout title="פרויקט חדש">
      <div className="max-w-2xl">
        <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary mb-5">
          <ArrowRight size={14} />
          חזרה לפרויקטים
        </Link>

        <div className="card space-y-4">
          <h2 className="font-semibold text-neutral-dark text-base">פרטי פרויקט</h2>

          {error && <div className="bg-red-50 border border-red-200 text-danger text-sm rounded-lg px-3 py-2">{error}</div>}

          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="שם הפרויקט *" id="name" value={form.name} onChange={set('name')} placeholder="בניין X — גוש Y" required />
            <Input label="כתובת *" id="address" value={form.address} onChange={set('address')} placeholder="רחוב, עיר" required />
          </div>

          <Textarea label="תיאור" id="description" value={form.description} onChange={set('description') as any} placeholder="תיאור קצר של הפרויקט..." />

          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="שם היזם" id="developerName" value={form.developerName} onChange={set('developerName')} />
            <Input label="קבלן ראשי" id="mainContractor" value={form.mainContractor} onChange={set('mainContractor')} />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <Input label="תאריך התחלה" id="startDate" type="date" value={form.startDate} onChange={set('startDate')} />
            <Input label="תאריך יעד" id="targetDate" type="date" value={form.targetDate} onChange={set('targetDate')} />
            <Select
              label="סטטוס"
              id="status"
              value={form.status}
              onChange={set('status')}
              options={[
                { value: 'PLANNING', label: 'תכנון' },
                { value: 'ACTIVE', label: 'פעיל' },
                { value: 'ON_HOLD', label: 'מושהה' },
                { value: 'COMPLETED', label: 'הושלם' },
                { value: 'CANCELLED', label: 'בוטל' },
              ]}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={() => mutation.mutate(form)} loading={mutation.isPending} disabled={!form.name || !form.address}>
              צור פרויקט
            </Button>
            <Link href="/projects"><Button variant="outline">ביטול</Button></Link>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
