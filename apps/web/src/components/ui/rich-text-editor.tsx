'use client'
import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import 'react-quill-new/dist/quill.snow.css'

// גופנים בטוחים ל-PDF: אלה שכבר זמינים בשרת (Arial/Segoe UI הם הבסיס של תבנית ה-PDF) —
// לא נבחרו גופנים מותאמים-אישית (כמו Heebo מגוגל פונטס) כי Puppeteer בשרת לא בהכרח יטען אותם
const FONT_WHITELIST = ['arial', 'times-new-roman', 'georgia', 'courier-new']
const FONT_LABELS: Record<string, string> = {
  arial: 'Arial (ברירת מחדל)',
  'times-new-roman': 'Times New Roman',
  georgia: 'Georgia',
  'courier-new': 'Courier New',
}
const SIZE_WHITELIST = ['12px', '14px', '16px', '18px', '20px', '24px', '28px']

const ReactQuill = dynamic(
  async () => {
    const mod = await import('react-quill-new')
    const Quill = (mod as any).Quill
    const SizeStyle = Quill.import('attributors/style/size')
    SizeStyle.whitelist = SIZE_WHITELIST
    Quill.register(SizeStyle, true)
    const FontStyle = Quill.import('attributors/style/font')
    FontStyle.whitelist = FONT_WHITELIST
    Quill.register(FontStyle, true)
    return mod.default
  },
  { ssr: false, loading: () => <div className="h-40 border border-gray-200 rounded-lg bg-gray-50 animate-pulse" /> }
)

interface RichTextEditorProps {
  label?: string
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export function RichTextEditor({ label, value, onChange, placeholder }: RichTextEditorProps) {
  const modules = useMemo(
    () => ({
      toolbar: [
        [{ font: FONT_WHITELIST }, { size: SIZE_WHITELIST }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ align: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ color: [] }, { background: [] }],
        ['clean'],
      ],
    }),
    []
  )

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-neutral-dark">{label}</label>}
      <div className="rich-text-editor border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-colors">
        <ReactQuill theme="snow" value={value} onChange={onChange} modules={modules} placeholder={placeholder} />
      </div>
      <style jsx global>{`
        .rich-text-editor .ql-toolbar { border: none; border-bottom: 1px solid #e5e7eb; direction: ltr; }
        .rich-text-editor .ql-container { border: none; direction: rtl; font-family: 'Heebo', 'Arial', sans-serif; font-size: 14px; }
        .rich-text-editor .ql-editor { min-height: 120px; text-align: right; }
        .rich-text-editor .ql-editor.ql-blank::before { right: 15px; left: auto; text-align: right; font-style: normal; color: #9ca3af; }
        ${FONT_WHITELIST.map(
          (f) => `
          .rich-text-editor .ql-picker.ql-font .ql-picker-label[data-value="${f}"]::before,
          .rich-text-editor .ql-picker.ql-font .ql-picker-item[data-value="${f}"]::before {
            content: '${FONT_LABELS[f]}';
            font-family: ${f};
          }
        `
        ).join('\n')}
        .rich-text-editor .ql-font-times-new-roman { font-family: 'Times New Roman', serif; }
        .rich-text-editor .ql-font-georgia { font-family: Georgia, serif; }
        .rich-text-editor .ql-font-courier-new { font-family: 'Courier New', monospace; }
      `}</style>
    </div>
  )
}
