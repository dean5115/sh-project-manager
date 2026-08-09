'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { useState, useEffect } from 'react'
import { ClipboardList, Check } from 'lucide-react'

const FIELDS = ['inspectorTitle', 'inspectorEducation', 'inspectorExperience', 'hiLegalDeclaration', 'hiLegalBasisList', 'hiMethodology', 'hiWarrantyExplainer', 'hiAdditionalContent'] as const
type FormState = Record<(typeof FIELDS)[number], string>

const EMPTY_FORM: FormState = {
  inspectorTitle: '', inspectorEducation: '', inspectorExperience: '',
  hiLegalDeclaration: '', hiLegalBasisList: '', hiMethodology: '', hiWarrantyExplainer: '', hiAdditionalContent: '',
}

// טקסטים שנשמרו כטקסט רגיל עם \n לפני שהעורך העשיר נוסף — ממירים ל-HTML כדי שירידות השורה
// לא ייעלמו בעורך (מזהים "טקסט רגיל" לפי היעדר תגיות HTML)
function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function normalizeRichText(text: string): string {
  if (!text || /<[a-z][\s\S]*>/i.test(text)) return text
  return text.split('\n').map((line) => `<p>${line ? escHtml(line) : '<br>'}</p>`).join('')
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
        inspectorEducation: normalizeRichText(org.data.inspectorEducation || ''),
        inspectorExperience: normalizeRichText(org.data.inspectorExperience || ''),
        hiLegalDeclaration: normalizeRichText(org.data.hiLegalDeclaration || ''),
        hiLegalBasisList: org.data.hiLegalBasisList || '',
        hiMethodology: normalizeRichText(org.data.hiMethodology || ''),
        hiWarrantyExplainer: normalizeRichText(org.data.hiWarrantyExplainer || ''),
        hiAdditionalContent: normalizeRichText(org.data.hiAdditionalContent || ''),
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
  const setRich = (k: keyof FormState) => (html: string) => setForm((f) => ({ ...f, [k]: html }))

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
          <RichTextEditor
            label='"אלה פרטי השכלתי"'
            value={form.inspectorEducation}
            onChange={setRich('inspectorEducation')}
            placeholder={'1. תואר ראשון - מהנדס אזרחי B.Sc. התמחות בביצוע ופיקוח מבנים.\n2. רשום ברשם המהנדסים מס\' תעודת רישוי ...'}
          />
          <RichTextEditor
            label='"אלה פרטי נסיוני"'
            value={form.inspectorExperience}
            onChange={setRich('inspectorExperience')}
            placeholder="מהנדס אזרחי בעל ניסיון מעשי בפרויקטי מגורים ובתחום התשתיות..."
          />
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-neutral-dark">עמוד פתיח</h3>
          <p className="text-xs text-gray-500 -mt-2">
            אפשר להשתמש בשדות הבאים בכל טקסט בעמוד הזה — הם יתמלאו אוטומטית לפי פרטי הדוח בעת ההפקה:{' '}
            <code className="bg-gray-100 px-1 rounded">{'{{שם המזמין}}'}</code>{' '}
            <code className="bg-gray-100 px-1 rounded">{'{{תאריך הביקור}}'}</code>{' '}
            <code className="bg-gray-100 px-1 rounded">{'{{כתובת הנכס}}'}</code>{' '}
            <code className="bg-gray-100 px-1 rounded">{'{{שם הבודק}}'}</code>
          </p>
          <RichTextEditor
            label="הצהרה משפטית (מודפסת בראש הדוח)"
            value={form.hiLegalDeclaration}
            onChange={setRich('hiLegalDeclaration')}
            placeholder='אני הח"מ, נתבקשתי ע"י {{שם המזמין}}, לתת את חוות דעתי המקצועית לעניין ליקויי בניה וחסרים בנכס הנ"ל. הביקור נערך בתאריך {{תאריך הביקור}}...'
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
          <RichTextEditor
            label="ציוד ושיטת בדיקה"
            value={form.hiMethodology}
            onChange={setRich('hiMethodology')}
            placeholder="הסתייעתי במכשור לאיתור רטיבות מבוסס על טכנולוגיה מתקדמת..."
          />
          <RichTextEditor
            label='"ידע כללי עבור הדייר" — הסבר תקופות בדק/אחריות'
            value={form.hiWarrantyExplainer}
            onChange={setRich('hiWarrantyExplainer')}
            placeholder={'קבלן המוכר דירה נושא באחריות לתיקון ליקויים שנתגלו בדירה בתקופה שלאחר מסירתה...\n\nתקופת הבדק — ...\nתקופת האחריות — ...'}
          />
        </div>

        <div className="card space-y-4">
          <h3 className="font-semibold text-neutral-dark">תוכן נוסף</h3>
          <RichTextEditor
            label="כל טקסט נוסף שתרצה שיופיע בעמודי הפתיח"
            value={form.hiAdditionalContent}
            onChange={setRich('hiAdditionalContent')}
          />
        </div>

        <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} className="w-full">
          {saved ? <span className="flex items-center gap-2"><Check size={16} /> נשמר בהצלחה!</span> : 'שמור שינויים'}
        </Button>
      </div>
    </AppLayout>
  )
}
