'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Plus, Wrench } from 'lucide-react'
import { ROLE_LABELS, CATEGORY_LABELS } from '@/lib/utils'
import { useState } from 'react'

const ROLE_OPTIONS = [
  { value: 'PROJECT_MANAGER', label: 'מנהל פרויקט' },
  { value: 'ENGINEER', label: 'מהנדס ביצוע' },
  { value: 'SUPERVISOR', label: 'מפקח' },
  { value: 'CLIENT', label: 'לקוח' },
]

const SPECIALTY_OPTIONS = [
  { value: '', label: 'ללא התמחות' },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
]

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-primary-100 text-primary',
  PROJECT_MANAGER: 'bg-blue-100 text-blue-700',
  ENGINEER: 'bg-green-100 text-green-700',
  SUPERVISOR: 'bg-purple-100 text-purple-700',
  CONTRACTOR: 'bg-orange-100 text-orange-700',
  CLIENT: 'bg-gray-100 text-gray-600',
}

export default function UsersPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [specialtyUser, setSpecialtyUser] = useState<any>(null)
  const [form, setForm] = useState({ name: '', email: '', role: 'ENGINEER', phone: '', password: 'Change1234!', specialty: '' })
  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const { data } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<{ data: any[] }>('/users'),
  })
  const users = data?.data ?? []

  const inviteMutation = useMutation({
    mutationFn: (d: typeof form) => api.post('/users/invite', { ...d, specialty: d.specialty || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setOpen(false)
      setForm({ name: '', email: '', role: 'ENGINEER', phone: '', password: 'Change1234!', specialty: '' })
    },
  })

  const specialtyMutation = useMutation({
    mutationFn: ({ id, specialty }: { id: string; specialty: string | null }) =>
      api.put(`/users/${id}/specialty`, { specialty }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setSpecialtyUser(null)
    },
  })

  return (
    <AppLayout title="ניהול משתמשים">
      <div className="max-w-4xl space-y-4">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={14} />
            הוספת משתמש
          </Button>
        </div>

        {/* הסבר auto-assign */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
          <strong>טיפ:</strong> הגדר לכל משתמש תחום התמחות — ליקויים מאותה קטגוריה יתשייכו אליו <strong>אוטומטית</strong> בעת פתיחתם.
        </div>

        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-gray-500">שם</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">אימייל</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">תפקיד</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">התמחות (auto-assign)</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-primary-50 rounded-full flex items-center justify-center text-primary text-xs font-bold">
                        {user.name?.[0]}
                      </div>
                      {user.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge className={ROLE_COLORS[user.role]}>{ROLE_LABELS[user.role]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {user.specialty ? (
                      <Badge className="bg-orange-100 text-orange-700 flex items-center gap-1 w-fit">
                        <Wrench size={10} />
                        {CATEGORY_LABELS[user.specialty] || user.specialty}
                      </Badge>
                    ) : (
                      <span className="text-gray-400 text-xs">לא הוגדר</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSpecialtyUser(user)}
                    >
                      <Wrench size={13} />
                      הגדר התמחות
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal — הוספת משתמש */}
      <Modal open={open} onClose={() => setOpen(false)} title="הוספת משתמש חדש" size="md">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="שם מלא *" value={form.name} onChange={set('name')} />
            <Input label="אימייל *" type="email" value={form.email} onChange={set('email')} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="טלפון" value={form.phone} onChange={set('phone')} />
            <Select label="תפקיד" value={form.role} onChange={set('role')} options={ROLE_OPTIONS} />
          </div>
          <p className="text-xs text-gray-400">
            לרישום קבלן (עם גישה למסך הקבלנים) — השתמש בעמוד &quot;קבלנים&quot; בתפריט, לא בטופס הזה.
          </p>
          <Select
            label="התמחות (לאוטומציה של ליקויים)"
            value={form.specialty}
            onChange={set('specialty')}
            options={SPECIALTY_OPTIONS}
          />
          <Input label="סיסמה זמנית" value={form.password} onChange={set('password')} />
          <p className="text-xs text-gray-400">ליקויים מקטגוריית ההתמחות יתשייכו למשתמש זה אוטומטית.</p>
          <div className="flex gap-2">
            <Button onClick={() => inviteMutation.mutate(form)} loading={inviteMutation.isPending} disabled={!form.name || !form.email}>
              הוסף משתמש
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
          </div>
        </div>
      </Modal>

      {/* Modal — עדכון התמחות */}
      {specialtyUser && (
        <Modal open={!!specialtyUser} onClose={() => setSpecialtyUser(null)} title={`התמחות — ${specialtyUser.name}`} size="sm">
          <SpecialtyForm
            user={specialtyUser}
            options={SPECIALTY_OPTIONS}
            onSave={(specialty) => specialtyMutation.mutate({ id: specialtyUser.id, specialty: specialty || null })}
            loading={specialtyMutation.isPending}
          />
        </Modal>
      )}
    </AppLayout>
  )
}

function SpecialtyForm({ user, options, onSave, loading }: {
  user: any; options: any[]; onSave: (s: string) => void; loading: boolean
}) {
  const [val, setVal] = useState(user.specialty || '')
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        בחר את תחום ההתמחות של <strong>{user.name}</strong>. ליקויים מקטגוריה זו יתשייכו אליו אוטומטית.
      </p>
      <Select
        label="תחום התמחות"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        options={options}
      />
      <div className="flex gap-2">
        <Button onClick={() => onSave(val)} loading={loading}>שמור</Button>
        <Button variant="outline" onClick={() => {}}>ביטול</Button>
      </div>
    </div>
  )
}
