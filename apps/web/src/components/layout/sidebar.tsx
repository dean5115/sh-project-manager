'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import {
  LayoutDashboard, FolderKanban, Users, Bell,
  FileText, LogOut, HardHat, ChevronLeft, X, Settings, Building2, Wallet, Download,
} from 'lucide-react'

const NAV = [
  { href: '/dashboard', label: 'דשבורד', icon: LayoutDashboard },
  { href: '/projects', label: 'פרויקטים', icon: FolderKanban },
  { href: '/contractors', label: 'קבלנים', icon: HardHat },
  { href: '/reports', label: 'דוחות', icon: FileText },
  { href: '/payments', label: 'לוח תשלומים', icon: Wallet },
  { href: '/settings/users', label: 'משתמשים', icon: Users },
  { href: '/settings/organization', label: 'הגדרות ארגון', icon: Building2 },
]

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { user, organization, logout } = useAuthStore()
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [isIos, setIsIos] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    setIsIos(ios)
    setIsStandalone(!!standalone)

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  return (
    <aside className="h-full w-[260px] bg-primary flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-primary-400/30">
        <div className="flex items-center gap-3">
          {/* כפתור סגירה במובייל */}
          {onClose && (
            <button onClick={onClose} className="md:hidden ml-auto text-primary-200 hover:text-white p-1">
              <X size={18} />
            </button>
          )}
          <div className="w-9 h-9 bg-secondary rounded-lg flex items-center justify-center">
            <HardHat size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">SH - Project Manager</p>
            <p className="text-primary-200 text-xs truncate max-w-[160px]">{organization?.name}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-white/15 text-white'
                  : 'text-primary-100 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon size={18} />
              {label}
              {active && <ChevronLeft size={14} className="mr-auto opacity-60" />}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-primary-400/30">
        {/* אנדרואיד — כפתור התקנה אוטומטי */}
        {installPrompt && (
          <button
            onClick={handleInstall}
            className="w-full flex items-center gap-3 px-3 py-2 mb-1 rounded-lg text-sm text-white bg-secondary/90 hover:bg-secondary transition-colors"
          >
            <Download size={16} />
            התקן אפליקציה
          </button>
        )}
        {/* אייפון — הנחייה ידנית (Safari לא תומך בהתקנה אוטומטית) */}
        {isIos && !isStandalone && !installPrompt && (
          <div className="mb-1 rounded-lg bg-white/10 px-3 py-2 text-xs text-primary-100 leading-relaxed">
            <p className="font-medium text-white mb-0.5">
              <Download size={12} className="inline ml-1" />
              הוסף למסך הבית
            </p>
            <p>לחץ על כפתור <strong>השיתוף</strong> (⬆) ואז <strong>"הוסף למסך הבית"</strong></p>
          </div>
        )}
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-white text-sm font-bold">
            {user?.name?.[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-primary-200 text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-primary-200 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut size={16} />
          התנתק
        </button>
        <div className="flex items-center justify-center gap-2 mt-2 text-[11px] text-primary-300">
          <Link href="/terms" className="hover:text-white hover:underline">תנאי שימוש</Link>
          <span>·</span>
          <Link href="/accessibility" className="hover:text-white hover:underline">נגישות</Link>
        </div>
      </div>
    </aside>
  )
}
