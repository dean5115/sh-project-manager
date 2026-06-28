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

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post<AuthResponse>('/auth/login', { email, password })
      setAuth(res.token, res.user, res.organization)
      router.replace(res.user.role === 'CONTRACTOR' ? '/portal/contractor' : '/dashboard')
    } catch (err: any) {
      setError(err.message || 'שגיאה בהתחברות')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <HardHat size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">SH - Project Manager</h1>
          <p className="text-primary-200 mt-1 text-sm">ניהול פרויקטי בנייה</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-neutral-dark text-center mb-2">כניסה למערכת</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-danger rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <Input
            label="אימייל"
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            autoComplete="email"
          />
          <Input
            label="סיסמה"
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            required
            autoComplete="current-password"
          />

          <Button type="submit" className="w-full" size="lg" loading={loading}>
            כניסה
          </Button>

          <p className="text-center text-sm text-gray-500">
            אין לך חשבון?{' '}
            <Link href="/register" className="text-primary font-medium hover:underline">
              הרשמה
            </Link>
          </p>

          <div className="pt-2 border-t border-gray-100 text-center">
            <Link href="/contractor-login" className="text-sm text-gray-400 hover:text-primary">
              קבלן? כנס כאן
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
