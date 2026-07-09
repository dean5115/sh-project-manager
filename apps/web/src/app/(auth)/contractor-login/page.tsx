'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { HardHat, Mail, Lock, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { AuthResponse } from '@sitepilot/types'

type Step = 'email' | 'create-password' | 'login'

export default function ContractorLoginPage() {
  return (
    <Suspense fallback={null}>
      <ContractorLoginForm />
    </Suspense>
  )
}

function ContractorLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth } = useAuthStore()

  const defectParam = searchParams.get('defect')
  const destination = defectParam ? `/portal/contractor?defect=${defectParam}` : '/portal/contractor'

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const prefill = searchParams.get('email')
    if (prefill) setEmail(prefill)
  }, [searchParams])

  async function handleCheckEmail(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post<{ ok: boolean; needsSetup: boolean }>('/auth/contractor/check', { email })
      setStep(res.needsSetup ? 'create-password' : 'login')
    } catch (err: any) {
      setError(err.message || 'לא נמצא קבלן עם כתובת מייל זו')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreatePassword(e: React.FormEvent) {
    e.preventDefault()
    if (password !== password2) { setError('הסיסמאות אינן תואמות'); return }
    if (password.length < 6) { setError('הסיסמה חייבת להכיל לפחות 6 תווים'); return }
    setError('')
    setLoading(true)
    try {
      const res = await api.post<AuthResponse>('/auth/contractor/create-password', { email, password })
      setAuth(res.token, res.user, res.organization)
      router.replace(destination)
    } catch (err: any) {
      setError(err.message || 'שגיאה — נסה שוב')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post<AuthResponse>('/auth/contractor/login', { email, password })
      setAuth(res.token, res.user, res.organization)
      router.replace(destination)
    } catch (err: any) {
      setError(err.message || 'סיסמה שגויה')
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
          <p className="text-primary-200 mt-1 text-sm">פורטל קבלנים</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-danger rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {/* שלב 1 — מייל */}
          {step === 'email' && (
            <form onSubmit={handleCheckEmail} className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <Mail size={20} className="text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-neutral-dark">כניסת קבלן</h2>
                <p className="text-sm text-gray-500 mt-1">הכנס את כתובת המייל שלך</p>
              </div>
              <Input
                label="כתובת מייל"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoComplete="email"
              />
              <Button type="submit" className="w-full" size="lg" loading={loading}>המשך</Button>
            </form>
          )}

          {/* שלב 2 — הגדרת סיסמה ראשונה */}
          {step === 'create-password' && (
            <form onSubmit={handleCreatePassword} className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-10 h-10 bg-secondary/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <Lock size={20} className="text-secondary" />
                </div>
                <h2 className="text-lg font-semibold text-neutral-dark">ברוך הבא!</h2>
                <p className="text-sm text-gray-500 mt-1">בחר סיסמה לכניסות הבאות</p>
                <p className="text-xs text-gray-400 mt-0.5">{email}</p>
              </div>
              <Input
                label="סיסמה חדשה"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="לפחות 6 תווים"
                required
                autoFocus
              />
              <Input
                label="אמת סיסמה"
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="הכנס שוב"
                required
              />
              <Button type="submit" className="w-full" size="lg" loading={loading} disabled={!password || !password2}>
                צור סיסמה וכנס לפורטל
              </Button>
              <button type="button" onClick={() => { setStep('email'); setError(''); setPassword(''); setPassword2('') }}
                className="w-full text-sm text-gray-400 hover:text-primary flex items-center justify-center gap-1">
                <ArrowRight size={13} /> חזרה
              </button>
            </form>
          )}

          {/* שלב 3 — כניסה עם סיסמה קיימת */}
          {step === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <Lock size={20} className="text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-neutral-dark">כניסה</h2>
                <p className="text-xs text-gray-400 mt-0.5">{email}</p>
              </div>
              <Input
                label="סיסמה"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                autoComplete="current-password"
              />
              <Button type="submit" className="w-full" size="lg" loading={loading}>כניסה לפורטל</Button>
              <button type="button" onClick={() => { setStep('email'); setError(''); setPassword('') }}
                className="w-full text-sm text-gray-400 hover:text-primary flex items-center justify-center gap-1">
                <ArrowRight size={13} /> חזרה
              </button>
            </form>
          )}

          <div className="pt-2 border-t border-gray-100 text-center">
            <Link href="/login" className="text-sm text-gray-400 hover:text-primary">כניסת צוות ניהול</Link>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-3 text-xs text-primary-200">
          <Link href="/terms" className="hover:text-white hover:underline">תנאי שימוש</Link>
          <span>·</span>
          <Link href="/accessibility" className="hover:text-white hover:underline">הצהרת נגישות</Link>
        </div>
      </div>
    </div>
  )
}
