'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { HardHat } from 'lucide-react'
import Link from 'next/link'
import type { AuthResponse } from '@sitepilot/types'

export default function RegisterPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [form, setForm] = useState({
    organizationName: '',
    name: '',
    email: '',
    password: '',
    phone: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post<AuthResponse>('/auth/register', form)
      setAuth(res.token, res.user, res.organization)
      router.replace('/dashboard')
    } catch (err: any) {
      setError(err.message || 'שגיאה בהרשמה')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <HardHat size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">SH - Project Manager</h1>
          <p className="text-primary-200 mt-1 text-sm">הרשמת חשבון חדש</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-neutral-dark text-center mb-2">יצירת חשבון</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-danger rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <Input label="שם החברה / הארגון" id="org" value={form.organizationName}
            onChange={set('organizationName')} placeholder="חברת בנייה לדוגמה" required />
          <Input label="שמך המלא" id="name" value={form.name}
            onChange={set('name')} placeholder="ישראל ישראלי" required />
          <Input label="אימייל" type="email" id="email" value={form.email}
            onChange={set('email')} placeholder="your@email.com" required />
          <Input label="טלפון" type="tel" id="phone" value={form.phone}
            onChange={set('phone')} placeholder="050-0000000" />
          <Input label="סיסמה" type="password" id="password" value={form.password}
            onChange={set('password')} placeholder="מינימום 6 תווים" required minLength={6} />

          <Button type="submit" className="w-full" size="lg" loading={loading}>
            יצירת חשבון
          </Button>

          <p className="text-center text-sm text-gray-500">
            יש לך חשבון?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">
              כניסה
            </Link>
          </p>
        </form>

        <div className="mt-5 flex items-center justify-center gap-3 text-xs text-primary-200">
          <Link href="/terms" className="hover:text-white hover:underline">תנאי שימוש</Link>
          <span>·</span>
          <Link href="/accessibility" className="hover:text-white hover:underline">הצהרת נגישות</Link>
        </div>
      </div>
    </div>
  )
}
