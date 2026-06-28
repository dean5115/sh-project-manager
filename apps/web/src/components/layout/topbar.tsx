'use client'
import { Bell, Search, Menu } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function TopBar({ title, onMenuClick }: { title?: string; onMenuClick?: () => void }) {
  const [search, setSearch] = useState('')
  const router = useRouter()

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ data: any[] }>('/notifications'),
    refetchInterval: 30_000,
  })

  const unread = data?.data?.filter((n) => !n.read).length ?? 0

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) router.push(`/search?q=${encodeURIComponent(search.trim())}`)
  }

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center gap-3 px-4 md:px-6 sticky top-0 z-20">
      {/* hamburger — mobile only */}
      <button onClick={onMenuClick} className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600">
        <Menu size={20} />
      </button>
      {title && <h1 className="text-base font-semibold text-neutral-dark">{title}</h1>}

      <form onSubmit={handleSearch} className="flex-1 max-w-xs mr-auto">
        <div className="relative">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש..."
            className="w-full border border-gray-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-gray-50"
          />
        </div>
      </form>

      <Link href="/notifications" className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
        <Bell size={20} className="text-gray-600" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -left-0.5 w-4 h-4 bg-danger rounded-full text-white text-[10px] flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Link>
    </header>
  )
}
