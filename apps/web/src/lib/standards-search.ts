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

// מילה מספרית מתאימה רק מתחילת מספר: "120" מוצא את 1205 (תוך כדי הקלדה), אבל "3" לא מוצא 1203 או 2003
function wordMatches(text: string, word: string): boolean {
  if (!/^\d/.test(word)) return text.includes(word)
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\d.])${escaped}`).test(text)
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

// כל מילה בחיפוש צריכה להופיע איפשהו (בכל סדר). התאמה במספר התקן עצמו מוצגת ראשונה.
export function searchStandards(standards: Standard[], query: string): Standard[] {
  const q = normalizeSearch(query)
  if (!q) return standards
  const words = q.split(' ')
  return standards
    .map((s, index) => {
      const text = haystack(s)
      if (!words.every((w) => wordMatches(text, w))) return null
      const code = normalizeSearch(s.code)
      const rank = code.includes(q) ? 0 : words.every((w) => wordMatches(code, w)) ? 1 : 2
      return { s, rank, index }
    })
    .filter((x): x is { s: Standard; rank: number; index: number } => !!x)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((x) => x.s)
}
