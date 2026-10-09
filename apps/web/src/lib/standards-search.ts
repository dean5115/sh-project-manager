import type { Standard } from '@sitepilot/types'
import { CATEGORY_LABELS } from '@/lib/utils'

const SOURCE_LABELS: Record<string, string> = {
  REGULATION: 'תקנות התכנון והבניה',
  HALAT: 'הל"ת',
  STANDARD: 'תקן',
}

// מנרמל טקסט לחיפוש: בלי גרש/גרשיים/מרכאות (ת"י = ת״י = תי), סימני פיסוק כרווח, אותיות קטנות.
// נקודה נשארת — היא חלק ממספרי סעיפים (3.3.1)
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/["'`״׳]/g, '')
    .replace(/[-_,:;()/\\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// מילה מספרית מתאימה רק מתחילת מספר: "120" מוצא את 1205 (תוך כדי הקלדה), אבל "3" לא מוצא 1203 או 2003
function wordMatches(text: string, word: string): boolean {
  if (!/^\d/.test(word)) return text.includes(word)
  return new RegExp(`(^|[^\\d.])${escapeRegex(word)}`).test(text)
}

function haystack(s: Standard): string {
  return normalizeSearch([
    s.code,
    s.description,
    s.precedenceNote,
    s.category ? CATEGORY_LABELS[s.category] : '',
    SOURCE_LABELS[s.sourceType],
  ].filter(Boolean).join(' '))
}

// כל מילה בחיפוש צריכה להופיע איפשהו (בכל סדר). הסדר: קודם התאמה בקוד התקן עצמו, אחר כך בתיאור.
export function searchStandards(standards: Standard[], query: string): Standard[] {
  const q = normalizeSearch(query)
  if (!q) return standards
  const words = q.split(' ')
  const isNumber = /^\d+$/.test(q)
  // ביטוי שלם בקוד; מספר בקצוות לא נחשב כחלק ממספר ארוך יותר ("תי 1920" לא תופס את 19200)
  const phrase = new RegExp(`${/^\d/.test(q) ? '(^|[^\\d.])' : ''}${escapeRegex(q)}${/\d$/.test(q) ? '(?!\\d)' : ''}`)
  return standards
    .map((s, index) => {
      const text = haystack(s)
      if (!words.every((w) => wordMatches(text, w))) return null
      const code = normalizeSearch(s.code)
      let rank: number
      if (isNumber) {
        // חיפוש לפי מספר ("1920"): התקן שזה המספר שלו (המספר הראשון בקוד) קודם, אחריו מספרים שמתחילים כך
        // (19200), אחריו קודים שהמספר מופיע בהם במקום אחר (סעיף/שנה), ובסוף התאמה רק בתיאור
        const codeNumber = code.match(/\d+/)?.[0]
        rank = codeNumber === q ? 0 : codeNumber?.startsWith(q) ? 1 : wordMatches(code, q) ? 2 : 3
      } else {
        rank = phrase.test(code) ? 0 : words.every((w) => wordMatches(code, w)) ? 1 : 2
      }
      return { s, rank, index }
    })
    .filter((x): x is { s: Standard; rank: number; index: number } => !!x)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((x) => x.s)
}
