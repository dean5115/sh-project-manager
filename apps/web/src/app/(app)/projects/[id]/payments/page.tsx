'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { formatDate, formatCurrency, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from '@/lib/utils'
import { Plus, Wallet, Trash2, AlertTriangle, ArrowRight, Pencil, Check, Receipt as ReceiptIcon, MessageCircle, Mail, Send } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import type { PaymentMilestone } from '@sitepilot/types'

export default function PaymentsPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState([{ title: '', percentage: '' }])
  const [deleteTarget, setDeleteTarget] = useState<PaymentMilestone | null>(null)
  const [editAmount, setEditAmount] = useState(false)
  const [amountInput, setAmountInput] = useState('')
  const [demandTarget, setDemandTarget] = useState<PaymentMilestone | null>(null)
  const [demandClientName, setDemandClientName] = useState('')
  const [editingReceiptNumId, setEditingReceiptNumId] = useState<string | null>(null)
  const [receiptNumInput, setReceiptNumInput] = useState('')
  const [payTarget, setPayTarget] = useState<PaymentMilestone | null>(null)
  const [payDateInput, setPayDateInput] = useState('')

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get<{ data: any }>(`/projects/${id}`),
    enabled: !!id,
  })

  const { data: paymentsData } = useQuery({
    queryKey: ['payments', id],
    queryFn: () => api.get<{ data: { contractAmount: number | null; milestones: PaymentMilestone[] } }>(`/projects/${id}/payments`),
    enabled: !!id,
  })

  const contractAmount = paymentsData?.data?.contractAmount ?? null
  const milestones = paymentsData?.data?.milestones ?? []

  const totalPercentage = milestones.reduce((sum, m) => sum + m.percentage, 0)
  const paidAmount = milestones
    .filter((m) => m.status === 'PAID')
    .reduce((sum, m) => sum + (contractAmount ? (contractAmount * m.percentage) / 100 : 0), 0)
  const totalAmount = contractAmount ? (contractAmount * totalPercentage) / 100 : 0
  const pendingAmount = totalAmount - paidAmount

  const saveAmountMutation = useMutation({
    mutationFn: (value: number) => api.put(`/projects/${id}`, { contractAmount: value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments', id] })
      qc.invalidateQueries({ queryKey: ['project', id] })
      setEditAmount(false)
    },
  })

  const addRow = () => setRows((r) => [...r, { title: '', percentage: '' }])
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i))
  const updateRow = (i: number, key: 'title' | 'percentage', value: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)))

  const rowsTotal = rows.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0)
  const validRows = rows.filter((r) => r.title.trim() && Number(r.percentage) > 0)

  const bulkMutation = useMutation({
    mutationFn: () =>
      api.post(`/projects/${id}/payments/bulk`, {
        items: validRows.map((r) => ({ title: r.title, percentage: Number(r.percentage) })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments', id] })
      setOpen(false)
      setRows([{ title: '', percentage: '' }])
    },
  })

  const updateMilestoneMutation = useMutation({
    mutationFn: ({ mid, data }: { mid: string; data: Record<string, any> }) => api.put(`/payments/${mid}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments', id] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (mid: string) => api.delete(`/payments/${mid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments', id] })
      setDeleteTarget(null)
    },
  })

  const demandMessage = (m: PaymentMilestone, name: string) => {
    const amount = contractAmount ? (contractAmount * m.percentage) / 100 : null
    const lines = [
      'דרישת תשלום',
      name ? `לכבוד ${name},` : '',
      `פרויקט: ${project?.data?.name || ''}`,
      `סעיף: ${m.title} (${m.percentage}%)`,
      amount !== null ? `סכום לתשלום: ${formatCurrency(amount)}` : '',
      m.dueDate ? `תאריך יעד: ${formatDate(m.dueDate)}` : '',
      '',
      project?.data?.organization?.name || '',
    ]
    return lines.filter(Boolean).join('\n')
  }

  return (
    <AppLayout title="לוח תשלומים">
      <div className="space-y-5">
        <Link href={`/projects/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-primary">
          <ArrowRight size={13} />
          {project?.data?.name}
        </Link>

        {/* Contract amount */}
        <div className="card">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Wallet size={16} className="text-primary" />
              סכום חוזה כולל
            </div>
            {!editAmount && (
              <button
                onClick={() => { setAmountInput(contractAmount ? String(contractAmount) : ''); setEditAmount(true) }}
                className="text-gray-400 hover:text-primary p-1"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
          {editAmount ? (
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="number"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0"
                className="max-w-[180px]"
              />
              <Button
                size="sm"
                onClick={() => saveAmountMutation.mutate(Number(amountInput))}
                loading={saveAmountMutation.isPending}
              >
                <Check size={14} />
                שמור
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditAmount(false)}>ביטול</Button>
            </div>
          ) : (
            <p className="text-2xl font-bold text-neutral-dark mt-1">{formatCurrency(contractAmount)}</p>
          )}
        </div>

        {/* Summary */}
        {contractAmount != null && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="card text-center py-3">
              <p className="text-lg font-bold text-green-600">{formatCurrency(paidAmount)}</p>
              <p className="text-xs text-gray-500">שולם</p>
            </div>
            <div className="card text-center py-3">
              <p className="text-lg font-bold text-orange-500">{formatCurrency(pendingAmount)}</p>
              <p className="text-xs text-gray-500">ממתין לתשלום</p>
            </div>
            <div className="card text-center py-3">
              <p className={`text-lg font-bold ${totalPercentage === 100 ? 'text-neutral-dark' : 'text-danger'}`}>
                {totalPercentage}%
              </p>
              <p className="text-xs text-gray-500">סך הסעיפים</p>
            </div>
          </div>
        )}

        {totalPercentage !== 100 && milestones.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700 flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0" />
            סך האחוזים בלוח התשלומים הוא {totalPercentage}% ולא 100% — בדוק שלא חסר או הוכפל סעיף.
          </div>
        )}

        <div className="flex justify-end">
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={14} />
            הוספת סעיפי תשלום
          </Button>
        </div>

        {/* Milestones list */}
        {milestones.length === 0 ? (
          <div className="card text-center py-12">
            <Wallet size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">אין סעיפי תשלום עדיין</p>
            <p className="text-gray-400 text-xs mt-1">הוסף סעיפים עם האחוז של כל אחד מתוך סכום החוזה</p>
          </div>
        ) : (
          <div className="space-y-2">
            {milestones.map((m) => {
              const amount = contractAmount ? (contractAmount * m.percentage) / 100 : null
              return (
                <div key={m.id} className="card flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-neutral-dark">{m.title}</p>
                      <Badge className={PAYMENT_STATUS_COLORS[m.status]}>{PAYMENT_STATUS_LABELS[m.status]}</Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {m.percentage}%{amount !== null ? ` · ${formatCurrency(amount)}` : ''}
                      {m.dueDate ? ` · יעד: ${formatDate(m.dueDate)}` : ''}
                      {m.status === 'PAID' && m.paidDate ? ` · שולם בתאריך ${formatDate(m.paidDate)}` : ''}
                    </p>
                    {m.notes && <p className="text-xs text-gray-400 mt-0.5">{m.notes}</p>}

                    {/* External receipt number — for users who issue receipts in separate accounting software */}
                    {editingReceiptNumId === m.id ? (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Input
                          value={receiptNumInput}
                          onChange={(e) => setReceiptNumInput(e.target.value)}
                          placeholder="מספר קבלה"
                          className="h-7 text-xs py-1 w-32"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            updateMilestoneMutation.mutate({ mid: m.id, data: { externalReceiptNumber: receiptNumInput || null } })
                            setEditingReceiptNumId(null)
                          }}
                          className="p-1.5 rounded-lg text-green-600 hover:bg-green-50"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => setEditingReceiptNumId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          ביטול
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setReceiptNumInput(m.externalReceiptNumber || ''); setEditingReceiptNumId(m.id) }}
                        className="flex items-center gap-1 mt-1.5 text-xs text-gray-400 hover:text-primary"
                      >
                        <ReceiptIcon size={11} />
                        {m.externalReceiptNumber ? `מספר קבלה: ${m.externalReceiptNumber}` : 'רשום מספר קבלה (הופקה בתוכנה אחרת)'}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setDemandClientName(project?.data?.developerName || ''); setDemandTarget(m) }}
                    >
                      <Send size={14} />
                      דרישת תשלום
                    </Button>
                    {m.status !== 'PAID' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setPayDateInput(new Date().toISOString().slice(0, 10)); setPayTarget(m) }}
                      >
                        סמן כשולם
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(m)}>
                      <Trash2 size={14} className="text-danger" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="הוספת סעיפי תשלום" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">רשמי שם לכל סעיף ואת האחוז שלו מתוך סכום החוזה. אפשר להוסיף כמה שורות שצריך.</p>

          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={row.title}
                  onChange={(e) => updateRow(i, 'title', e.target.value)}
                  placeholder="לדוגמה: מקדמה, יסודות, שלד, גמר"
                  className="flex-1"
                />
                <div className="flex items-center gap-1 w-24 shrink-0">
                  <Input
                    type="number"
                    value={row.percentage}
                    onChange={(e) => updateRow(i, 'percentage', e.target.value)}
                    placeholder="0"
                  />
                  <span className="text-sm text-gray-400">%</span>
                </div>
                <button
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  className="p-2 rounded-lg text-gray-400 hover:text-danger hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addRow}
            className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
          >
            <Plus size={14} />
            הוסף שורה
          </button>

          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-sm text-gray-500">סה״כ אחוזים בטבלה זו</span>
            <span className={`font-bold ${rowsTotal === 100 ? 'text-neutral-dark' : 'text-danger'}`}>{rowsTotal}%</span>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => bulkMutation.mutate()}
              loading={bulkMutation.isPending}
              disabled={validRows.length === 0}
            >
              שמור {validRows.length > 0 ? `(${validRows.length} סעיפים)` : ''}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="מחיקת סעיף תשלום" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            למחוק את הסעיף <strong>{deleteTarget?.title}</strong>? לא ניתן לשחזר פעולה זו.
          </p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              loading={deleteMutation.isPending}
            >
              מחק סעיף
            </Button>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>ביטול</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!demandTarget} onClose={() => setDemandTarget(null)} title="דרישת תשלום" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            שליחת דרישת תשלום עבור <strong>{demandTarget?.title}</strong> בסך{' '}
            <strong>
              {formatCurrency(contractAmount && demandTarget ? (contractAmount * demandTarget.percentage) / 100 : null)}
            </strong>
          </p>
          <Input
            label="לכבוד (שם הלקוח / יזם)"
            value={demandClientName}
            onChange={(e) => setDemandClientName(e.target.value)}
            placeholder={project?.data?.developerName || project?.data?.name}
          />
          <div className="grid grid-cols-1 gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(demandTarget ? demandMessage(demandTarget, demandClientName) : '')}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline" className="w-full justify-start bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
                <MessageCircle size={16} />
                שלח בוואטסאפ
              </Button>
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent('דרישת תשלום')}&body=${encodeURIComponent(demandTarget ? demandMessage(demandTarget, demandClientName) : '')}`}
            >
              <Button variant="outline" className="w-full justify-start">
                <Mail size={16} />
                שלח במייל
              </Button>
            </a>
          </div>
          <Button variant="ghost" onClick={() => setDemandTarget(null)} className="w-full">סגור</Button>
        </div>
      </Modal>

      <Modal open={!!payTarget} onClose={() => setPayTarget(null)} title="סימון כשולם" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            סימון הסעיף <strong>{payTarget?.title}</strong> כשולם. באיזה תאריך התקבל התשלום בפועל?
          </p>
          <Input
            label="תאריך תשלום"
            type="date"
            value={payDateInput}
            onChange={(e) => setPayDateInput(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              onClick={() => payTarget && updateMilestoneMutation.mutate(
                { mid: payTarget.id, data: { status: 'PAID', paidDate: payDateInput ? new Date(payDateInput).toISOString() : new Date().toISOString() } },
                { onSuccess: () => setPayTarget(null) }
              )}
              loading={updateMilestoneMutation.isPending}
            >
              אישור
            </Button>
            <Button variant="outline" onClick={() => setPayTarget(null)}>ביטול</Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}
