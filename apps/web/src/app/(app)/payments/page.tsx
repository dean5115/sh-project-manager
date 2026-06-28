'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'
import { Wallet, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ProjectPaymentSummary {
  id: string
  name: string
  status: string
  contractAmount: number | null
  totalPercentage: number
  totalAmount: number
  paidAmount: number
  pendingAmount: number
  milestonesCount: number
}

export default function PaymentsOverviewPage() {
  const { data } = useQuery({
    queryKey: ['payments-overview'],
    queryFn: () =>
      api.get<{ data: { projects: ProjectPaymentSummary[]; totals: { contractAmount: number; paidAmount: number; pendingAmount: number } } }>(
        '/payments/overview'
      ),
  })

  const projects = data?.data?.projects ?? []
  const totals = data?.data?.totals

  return (
    <AppLayout title="לוח תשלומים — כל הפרויקטים">
      <div className="space-y-5">
        {/* Org-wide totals */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="card text-center py-4">
            <p className="text-xl font-bold text-neutral-dark">{formatCurrency(totals?.contractAmount)}</p>
            <p className="text-xs text-gray-500 mt-1">סך חוזים בכל הפרויקטים</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-xl font-bold text-green-600">{formatCurrency(totals?.paidAmount)}</p>
            <p className="text-xs text-gray-500 mt-1">סך שולם</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-xl font-bold text-orange-500">{formatCurrency(totals?.pendingAmount)}</p>
            <p className="text-xs text-gray-500 mt-1">סך ממתין לתשלום</p>
          </div>
        </div>

        {/* Per-project breakdown */}
        {projects.length === 0 ? (
          <div className="card text-center py-12">
            <Wallet size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">אין פרויקטים עדיין</p>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => {
              const progress = p.totalAmount > 0 ? Math.round((p.paidAmount / p.totalAmount) * 100) : 0
              return (
                <Link key={p.id} href={`/projects/${p.id}/payments`}>
                  <div className="card hover:shadow-card-hover hover:border-primary/30 transition-all cursor-pointer">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-neutral-dark">{p.name}</p>
                        <Badge className={STATUS_COLORS[p.status as keyof typeof STATUS_COLORS]}>
                          {STATUS_LABELS[p.status]}
                        </Badge>
                      </div>
                      <ArrowLeft size={14} className="text-gray-300" />
                    </div>

                    {p.contractAmount == null ? (
                      <p className="text-xs text-gray-400 mt-2">לא הוגדר סכום חוזה</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-3 mt-3 text-center">
                          <div>
                            <p className="text-sm font-bold text-neutral-dark">{formatCurrency(p.contractAmount)}</p>
                            <p className="text-xs text-gray-400">סכום חוזה</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-green-600">{formatCurrency(p.paidAmount)}</p>
                            <p className="text-xs text-gray-400">שולם</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-orange-500">{formatCurrency(p.pendingAmount)}</p>
                            <p className="text-xs text-gray-400">ממתין</p>
                          </div>
                        </div>
                        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                        {p.totalPercentage !== 100 && (
                          <p className="text-xs text-danger mt-1.5">
                            סך הסעיפים בלוח התשלומים הוא {p.totalPercentage}% מהחוזה
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
