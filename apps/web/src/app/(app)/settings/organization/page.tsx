'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState, useEffect, useRef } from 'react'
import { Building2, Upload, Check } from 'lucide-react'

export default function OrganizationSettingsPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    name: '', tagline: '', phone: '', contactEmail: '', address: '', website: '', primaryColor: '#1B4F72', taxId: '',
  })
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)

  const { data: org } = useQuery({
    queryKey: ['organization'],
    queryFn: () => api.get<{ data: any }>('/organization'),
  })

  useEffect(() => {
    if (org?.data) {
      setForm({
        name: org.data.name || '',
        tagline: org.data.tagline || '',
        phone: org.data.phone || '',
        contactEmail: org.data.contactEmail || '',
        address: org.data.address || '',
        website: org.data.website || '',
        primaryColor: org.data.primaryColor || '#1B4F72',
        taxId: org.data.taxId || '',
      })
    }
  }, [org])

  const saveMutation = useMutation({
    mutationFn: () => api.put('/organization', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organization'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const uploadLogo = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      await api.upload('/organization/logo', fd)
      qc.invalidateQueries({ queryKey: ['organization'] })
    } finally {
      setUploading(false)
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const logoUrl = org?.data?.logo

  return (
    <AppLayout title="הגדרות ארגון">
      <div className="max-w-lg space-y-5">

        {/* Logo */}
        <div className="card">
          <h3 className="font-semibold text-neutral-dark mb-4 flex items-center gap-2">
            <Building2 size={16} />
            לוגו החברה
          </h3>
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl
                ? <img src={logoUrl} alt="לוגו" className="w-full h-full object-contain p-1" />
                : <Upload size={24} className="text-gray-300" />
              }
            </div>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                loading={uploading}
              >
                <Upload size={14} />
                {logoUrl ? 'החלף לוגו' : 'העלה לוגו'}
              </Button>
              <p className="text-xs text-gray-400 mt-1.5">PNG, JPG או SVG, עד 2MB</p>
              <p className="text-xs text-gray-400">יופיע בכותרת כל הדוחות</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
              />
            </div>
          </div>
        </div>

        {/* Company info */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-neutral-dark">פרטי החברה</h3>
          <Input label="שם החברה *" value={form.name} onChange={set('name')} />
          <Input
            label="סלוגן / תיאור קצר"
            value={form.tagline}
            onChange={set('tagline')}
            placeholder="מקצועיות. אמינות. בנייה."
          />
          <Input label="טלפון" value={form.phone} onChange={set('phone')} placeholder="03-1234567" />
          <Input
            label="מייל ליצירת קשר (מוצג בכותרת התחתונה של הדוחות)"
            value={form.contactEmail}
            onChange={set('contactEmail')}
            placeholder="office@example.co.il"
          />
          <Input label="כתובת משרד" value={form.address} onChange={set('address')} />
          <Input label="אתר אינטרנט" value={form.website} onChange={set('website')} placeholder="www.example.co.il" />
          <Input
            label="עוסק מורשה / ח.פ (להפקת קבלות)"
            value={form.taxId}
            onChange={set('taxId')}
            placeholder="123456789"
          />
        </div>

        {/* Brand color */}
        <div className="card">
          <h3 className="font-semibold text-neutral-dark mb-1">צבע מותג</h3>
          <p className="text-xs text-gray-400 mb-4">משמש לכותרות הדוחות ולאלמנטים בולטים</p>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={form.primaryColor}
              onChange={set('primaryColor')}
              className="w-14 h-14 rounded-xl border border-gray-200 cursor-pointer p-1 bg-white"
            />
            <div className="flex-1">
              <p className="text-sm font-mono font-medium">{form.primaryColor}</p>
              <p className="text-xs text-gray-400 mt-0.5">לחץ על הריבוע לבחירת צבע</p>
            </div>
            <div
              className="w-14 h-14 rounded-xl border border-gray-200 shadow-sm"
              style={{ background: form.primaryColor }}
            />
          </div>
        </div>

        {/* Presets */}
        <div className="card">
          <h3 className="font-semibold text-neutral-dark mb-3 text-sm">צבעים מוכנים</h3>
          <div className="flex gap-2 flex-wrap">
            {[
              { color: '#1B4F72', name: 'כחול פלדה' },
              { color: '#1A5276', name: 'כחול כהה' },
              { color: '#145A32', name: 'ירוק כהה' },
              { color: '#7B241C', name: 'אדום כהה' },
              { color: '#4A235A', name: 'סגול' },
              { color: '#212F3D', name: 'אפור כהה' },
              { color: '#784212', name: 'חום' },
              { color: '#154360', name: 'ים' },
            ].map(({ color, name }) => (
              <button
                key={color}
                title={name}
                onClick={() => setForm((f) => ({ ...f, primaryColor: color }))}
                className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                  form.primaryColor === color ? 'border-gray-700 scale-110' : 'border-transparent'
                }`}
                style={{ background: color }}
              />
            ))}
          </div>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          loading={saveMutation.isPending}
          className="w-full"
        >
          {saved ? (
            <span className="flex items-center gap-2"><Check size={16} /> נשמר בהצלחה!</span>
          ) : 'שמור שינויים'}
        </Button>
      </div>
    </AppLayout>
  )
}
