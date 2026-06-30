import Link from 'next/link'
import { HardHat, ArrowRight } from 'lucide-react'

const LAST_UPDATED = '30.06.2026'

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary text-white px-4 py-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-secondary rounded-lg flex items-center justify-center shrink-0">
          <HardHat size={18} />
        </div>
        <p className="font-bold text-sm">SH - Project Manager</p>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-8">
        <Link href="/login" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-primary mb-4">
          <ArrowRight size={13} />
          חזרה
        </Link>

        <h1 className="text-2xl font-bold text-neutral-dark mb-1">הצהרת נגישות</h1>
        <p className="text-xs text-gray-400 mb-6">עודכן לאחרונה: {LAST_UPDATED}</p>

        <div className="space-y-5 text-sm leading-relaxed text-gray-700">
          <section>
            <p>
              אנו ב-SH - Project Manager רואים חשיבות רבה במתן שירות שוויוני ונגיש לכלל המשתמשים, לרבות אנשים עם
              מוגבלות, ופועלים להנגשת המערכת בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, התשנ&quot;ח-1998, ולתקנות
              שהותקנו מכוחו.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-neutral-dark mb-1.5">פעולות הנגשה שננקטו</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>תמיכה מלאה בכיווניות מימין-לשמאל (RTL) בהתאם לשפה העברית</li>
              <li>שימוש בקוד סמנטי ומבנה עמודים עקבי</li>
              <li>ניווט מלא במקלדת בטפסים ובפעולות עיקריות</li>
              <li>ניגודיות צבעים נבחרת לשיפור הקריאות</li>
              <li>תוויות טקסט (labels) לשדות קלט בטפסים</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-neutral-dark mb-1.5">הנגשה בתהליך מתמשך</h2>
            <p>
              המערכת נמצאת בפיתוח פעיל, ואנו ממשיכים לבחון ולשפר את רמת הנגישות שלה לאורך זמן, מתוך כוונה להגיע
              להתאמה לתקן הישראלי ת&quot;י 5568 (WCAG 2.0 ברמה AA). ייתכן שבשלב זה לא כל מרכיבי המערכת נגישים
              באופן מלא.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-neutral-dark mb-1.5">פניות בנושא נגישות</h2>
            <p>
              נתקלתם בבעיית נגישות או יש לכם הצעה לשיפור? נשמח שתפנו אלינו ונטפל בפנייה בהקדם:
            </p>
            <p className="mt-1">
              <a href="mailto:deanhayke@gmail.com" className="text-primary hover:underline">deanhayke@gmail.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
