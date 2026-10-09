'use client'
import { useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Standard } from '@sitepilot/types'
import { searchStandards } from '@/lib/standards-search'

// מעל כמות כזו של תקנים מציגים שדה חיפוש — כדי לא לגלול על כל הרשימה
const SEARCH_THRESHOLD = 8

interface Props {
  // התקנים שמוצגים כברירת מחדל (למשל רק של הקטגוריה של הממצא)
  standards: Standard[]
  // בחיפוש מחפשים בכל הספרייה — מי שמקליד מספר תקן מחפש אותו גם אם הוא בקטגוריה אחרת
  searchPool?: Standard[]
  selectedIds: string[]
  onToggle: (id: string) => void
  // צ'יפ נוסף בסוף הרשימה (למשל "הוסף תקן חדש")
  extra?: React.ReactNode
}

// בחירת תקנים כצ'יפים, עם חיפוש. תקנים שכבר נבחרו תמיד מוצגים, גם אם לא תואמים לחיפוש.
export function StandardChipPicker({ standards, searchPool, selectedIds, onToggle, extra }: Props) {
  const [query, setQuery] = useState('')
  const pool = searchPool ?? standards
  const showSearch = pool.length > SEARCH_THRESHOLD
  const matches = query.trim() ? searchStandards(pool, query) : standards
  const selectedHidden = pool.filter((s) => selectedIds.includes(s.id) && !matches.includes(s))
  const visible = [...selectedHidden, ...matches]

  return (
    <div className="mt-1.5 space-y-2">
      {showSearch && (
        <div className="relative">
          <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חפש תקן — מספר, נושא או מקצוע"
            className="w-full text-sm border border-gray-200 rounded-lg pr-8 pl-8 py-1.5 focus:outline-none focus:border-primary"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="נקה חיפוש"
              className="absolute left-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {visible.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onToggle(s.id)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              selectedIds.includes(s.id)
                ? 'bg-primary text-white border-primary'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-primary/40'
            }`}
          >
            {s.code}
          </button>
        ))}
        {extra}
      </div>
      {query.trim() && matches.length === 0 && (
        <p className="text-xs text-gray-400">לא נמצאו תקנים עבור "{query}" — אפשר להוסיף אותו ב"ספריית תקנים"</p>
      )}
      {!query.trim() && standards.length === 0 && pool.length > 0 && (
        <p className="text-xs text-gray-400">אין תקנים בקטגוריה הזו — חפש למעלה בכל התקנים</p>
      )}
    </div>
  )
}
