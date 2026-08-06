'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { useState, useEffect } from 'react'
import { ClipboardList, Check } from 'lucide-react'

const FIELDS = ['inspectorTitle', 'inspectorEducation', 'inspectorExperience', 'hiLegalDeclaration', 'hiLegalBasisList', 'hiMethodology', 'hiWarrantyExplainer', 'hiAdditionalContent'] as const
type FormState = Record<(typeof FIELDS)[number], string>

const EMPTY_FORM: FormState = {
  inspectorTitle: '', inspectorEducation: '', inspectorExperience: '',
  hiLegalDeclaration: '', hiLegalBasisList: '', hiMethodology: '', hiWarrantyExplainer: '', hiAdditionalContent: '',
}

export default function HomeInspectionSettingsPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saved, setSaved] = useState(false)

  const { data: org } = useQuery({
    queryKey: ['organization'],
    queryFn: () => api.get<{ data: any }>('/organization'),
  })

  useEffect(() => {
    if (org?.data) {
      setForm({
        inspectorTitle: org.data.inspectorTitle || '',
        inspectorEducation: org.data.inspectorEducation || '',
        inspectorExperience: org.data.inspectorExperience || '',
        hiLegalDeclaration: org.data.hiLegalDeclaration || '',
        hiLegalBasisList: org.data.hiLegalBasisList || '',
        hiMethodology: org.data.hiMethodology || '',
        hiWarrantyExplainer: org.data.hiWarrantyExplainer || '',
        hiAdditionalContent: org.data.hiAdditionalContent || '',
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

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <AppLayout title="דוח בדק בית — טקסטים קבועים">
      <div className="max-w-2xl space-y-5">
        <div className="card bg-primary-50/40 border-primary/20">
          <div className="flex items-start gap-3">
            <ClipboardList size={18} className="text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600">
              הטקסטים כאן מודפסים בעמודי הפתיח של <strong>כל</strong> דוח בדק בית שתפיק — פעם אחת כאן, ולא צריך להזין שוב בכל דוח.
              כל שדה אופציונלי: מה שתשאיר ריק פשוט לא יודפס.
            </p>
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-neutral-dark">פרטי הבודק</h3>
          <Input
            label="תפקיד / תואר (מוצג מתחת לשם בחתימת הדוח)"
            value={form.inspectorTitle}
            onChange={set('inspectorTitle')}
            placeholder="מהנדס אזרחי"
          />
          <Textarea
            label='"אלה פרטי השכלתי"'
            value={form.inspectorEducation}
            onChange={set('inspectorEducation')}
            placeholder={'1. תואר ראשון - מהנדס אזרחי B.Sc. התמחות בביצוע ופיקוח מבנים.\n2. רשום ברשם המהנדסים מס\' תעודת רישוי ...'}
            rows={4}
          />
          <Textarea
            label='"אלה פרטי נסיוני"'
            value={form.inspectorExperience}
            onChange={set('inspectorExperience')}
            placeholder="מהנדס אזרחי בעל ניסיון מעשי בפרויקטי מגורים ובתחום התשתיות..."
            rows={4}
          />
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-neutral-dark">עמוד פתיח</h3>
          <Textarea
            label="הצהרה משפטית (מודפסת בראש הדוח)"
            value={form.hiLegalDeclaration}
            onChange={set('hiLegalDeclaration')}
            placeholder='אני הח"מ, נתבקשתי לתת את חוות דעתי המקצועית לעניין ליקויי בניה וחסרים בנכס הנ"ל...'
            rows={6}
          />
          <Textarea
            label='"חוות הדעת מתבססת על" — שורה אחת לכל מקור'
            value={form.hiLegalBasisList}
            onChange={set('hiLegalBasisList')}
            placeholder={'ת"י - תקן הישראלי ומפרטי מכון בתחום הבניה\nחוק המכר (דירות) תשל"ג 1973\nתקנות התכנון והבניה...\nהל"ת, הוראות למתקני תברואה'}
            rows={6}
          />
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-neutral-dark">מתודולוגיה ומידע לדייר</h3>
          <Textarea
            label="ציוד ושיטת בדיקה"
            value={form.hiMethodology}
            onChange={set('hiMethodology')}
            placeholder="הסתייעתי במכשור לאיתור רטיבות מבוסס על טכנולוגיה מתקדמת..."
            rows={4}
          />
          <Textarea
            label='"ידע כללי עבור הדייר" — הסבר תקופות בדק/אחריות'
            value={form.hiWarrantyExplainer}
            onChange={set('hiWarrantyExplainer')}
            placeholder={'קבלן המוכר דירה נושא באחריות לתיקון ליקויים שנתגלו בדירה בתקופה שלאחר מסירתה...\n\nתקופת הבדק — ...\nתקופת האחריות — ...'}
            rows={8}
          />
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-neutral-dark">תוכן נוסף</h3>
          <Textarea
            label="כל טקסט נוסף שתרצה שיופיע בעמודי הפתיח"
            value={form.hiAdditionalContent}
            onChange={set('hiAdditionalContent')}
            rows={4}
          />
        </div>

        <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} className="w-full">
          {saved ? <span className="flex items-center gap-2"><Check size={16} /> נשמר בהצלחה!</span> : 'שמור שינויים'}
        </Button>
      </div>
    </AppLayout>
  )
}
