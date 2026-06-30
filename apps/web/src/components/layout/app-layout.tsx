'use client'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Sidebar } from './sidebar'
import { TopBar } from './topbar'
import { Menu, X } from 'lucide-react'

export function AppLayout({ children, title }: { children: React.ReactNode; title?: string }) {
  const { isAuthenticated, user } = useAuthStore()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    if (!isAuthenticated()) { router.replace('/login'); return }
    if (user?.role === 'CONTRACTOR') router.replace('/portal/contractor')
    if (user?.role === 'CLIENT') router.replace('/portal/client')
  }, [mounted, isAuthenticated, user, router])

  // Before mount: return null on both server and client — no hydration mismatch
  if (!mounted || !isAuthenticated() || user?.role === 'CONTRACTOR' || user?.role === 'CLIENT') return null

  return (
    <div className="min-h-screen flex">
      {/* Sidebar — desktop: fixed, mobile: drawer */}
      <div className={`
        fixed top-0 right-0 h-screen w-[260px] z-40 transition-transform duration-300
        md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Overlay on mobile when sidebar open */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col md:mr-[260px] min-w-0">
        <TopBar title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
