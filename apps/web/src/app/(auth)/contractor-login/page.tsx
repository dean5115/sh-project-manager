'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { HardHat, Mail, KeyRound, ArrowRight, Lock } from 'lucide-react'
import Link from 'next/link'
import type { AuthResponse } from '@sitepilot/types'

type Step = 'email' | 'otp' | 'set-password' | 'login'

export default function ContractorLoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [setupToken, setSetupToken] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/contractor/request-otp', { email })
      setStep('otp')
    } catch (err: any) {
      setError(err.message || 'שגיאה — בדוק שהמייל נכון')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post<any>('/auth/contractor/verify-otp', { email, otp })
      if (res.needsPasswordSetup) {
        setSetupToken(res.setupToken)
        setStep('set-password')
      } else {
        setAuth(res.token, res.user, res.organization)
        router.replace('/portal/contractor')
      }
    } catch (err: any) {
      setError(err.message || 'קוד שגוי — נסה שוב')
    } finally {
      setLoading(false)
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (password !== password2) { setError('הסיסמאות אינן תואמות'); return }
    if (password.length < 6) { setError('הסיסמה חייבת להכיל לפחות 6 תווים'); return }
    setError('')
    setLoading(true)
    try {
      const res = await api.post<AuthResponse>('/auth/contractor/set-password', { setupToken, password })
      setAuth(res.token, res.user, res.organization)
      router.replace('/portal/contractor')
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
      const res = await api.post<AuthResponse>('/auth/contractor/login', { email, password: loginPassword })
      setAuth(res.token, res.user, res.organization)
      router.replace('/portal/contractor')
    } catch (err: any) {
      setError(err.message || 'פרטים שגויים')
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
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <Mail size={20} className="text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-neutral-dark">כניסת קבלן</h2>
                <p className="text-sm text-gray-500 mt-1">הכנס מייל לקבלת קוד אימות</p>
              </div>
              <Input label="כתובת מייל" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required autoComplete="email" />
              <Button type="submit" className="w-full" size="lg" loading={loading}>שלח קוד כניסה</Button>
              <button type="button" onClick={() => { setStep('login'); setError('') }}
                className="w-full text-sm text-gray-400 hover:text-primary text-center">
                יש לי כבר סיסמה — כניסה ישירה
              </button>
            </form>
          )}

          {/* שלב 2 — OTP */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <KeyRound size={20} className="text-success" />
                </div>
                <h2 className="text-lg font-semibold text-neutral-dark">הזן קוד כניסה</h2>
                <p className="text-sm text-gray-500 mt-1">
                  קוד נשלח ל-<span className="font-medium text-neutral-dark">{email}</span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-dark mb-1.5">קוד 6 ספרות</label>
                <input type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="000000" required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  autoComplete="one-time-code" autoFocus />
              </div>
              <Button type="submit" className="w-full" size="lg" loading={loading} disabled={otp.length !== 6}>
                אמת קוד
              </Button>
              <button type="button" onClick={() => { setStep('email'); setOtp(''); setError('') }}
                className="w-full text-sm text-gray-400 hover:text-primary flex items-center justify-center gap-1">
                <ArrowRight size={13} />שלח קוד חדש
              </button>
            </form>
          )}

          {/* שלב 3 — הגדרת סיסמה (פעם ראשונה) */}
          {step === 'set-password' && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-10 h-10 bg-secondary/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <Lock size={20} className="text-secondary" />
                </div>
                <h2 className="text-lg font-semibold text-neutral-dark">הגדר סיסמה</h2>
                <p className="text-sm text-gray-500 mt-1">בחר סיסמה לכניסות הבאות</p>
              </div>
              <Input label="סיסמה חדשה" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="לפחות 6 תווים" required autoFocus />
              <Input label="אמת סיסמה" type="password" value={password2}
                onChange={(e) => setPassword2(e.target.value)} placeholder="הכנס שוב" required />
              <Button type="submit" className="w-full" size="lg" loading={loading} disabled={!password || !password2}>
                שמור וכנס לפורטל
              </Button>
            </form>
          )}

          {/* כניסה עם סיסמה קיימת */}
          {step === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <Lock size={20} className="text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-neutral-dark">כניסת קבלן</h2>
              </div>
              <Input label="מייל" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              <Input label="סיסמה" type="password" value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)} required autoComplete="current-password" />
              <Button type="submit" className="w-full" size="lg" loading={loading}>כניסה</Button>
              <button type="button" onClick={() => { setStep('email'); setError('') }}
                className="w-full text-sm text-gray-400 hover:text-primary text-center">
                שכחתי סיסמה — שלח קוד למייל
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
