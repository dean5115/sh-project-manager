import Link from 'next/link'
import { HardHat, ArrowRight } from 'lucide-react'

const LAST_UPDATED = '30.06.2026'

export default function TermsPage() {
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

        <h1 className="text-2xl font-bold text-neutral-dark mb-1">תנאי שימוש ומדיניות פרטיות</h1>
        <p className="text-xs text-gray-400 mb-6">עודכן לאחרונה: {LAST_UPDATED}</p>

        <div className="space-y-5 text-sm leading-relaxed text-gray-700">
          <section>
            <p>
              ברוכים הבאים ל-SH - Project Manager (&quot;המערכת&quot;). השימוש במערכת מהווה הסכמה לתנאים המפורטים
              להלן. אם אינך מסכים לתנאים, אנא הימנע משימוש במערכת.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-neutral-dark mb-1.5">1. מהות השירות</h2>
            <p>
              המערכת מספקת כלים לניהול פרויקטי בנייה — יומן עבודה, ניהול משימות וליקויים, תיעוד תמונות, הפקת
              דוחות, ולוח תשלומים — לשימוש חברות וצוותי ניהול בענפי הבנייה והפיקוח.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-neutral-dark mb-1.5">2. חשבון משתמש</h2>
            <p>
              הגישה למערכת מותנית ברישום וקבלת פרטי התחברות אישיים. עליך לשמור על סודיות פרטי ההתחברות ולא
              להעבירם לצד שלישי. הארגון הרושם אחראי על ניהול המשתמשים וההרשאות בחשבונו.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-neutral-dark mb-1.5">3. תוכן ונתונים</h2>
            <p>
              כל הנתונים, התמונות והמסמכים שמועלים למערכת (&quot;תוכן המשתמש&quot;) נשארים בבעלות הארגון
              והמשתמשים שהעלו אותם. אנו שומרים את התוכן לצורך מתן השירות בלבד, ולא נעשה בו שימוש לכל מטרה אחרת
              ללא הסכמה.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-neutral-dark mb-1.5">4. שימוש נאות</h2>
            <p>
              חל איסור על שימוש במערכת לצרכים בלתי חוקיים, להעלאת תוכן פוגעני, או לניסיון לפגוע באבטחת המערכת
              או בנתוני משתמשים אחרים.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-neutral-dark mb-1.5">5. זמינות ואחריות</h2>
            <p>
              אנו פועלים לשמירה על זמינות ותקינות המערכת, אך אינה מובטחת זמינות רציפה ללא תקלות. המערכת מסופקת
              &quot;כפי שהיא&quot; (AS-IS), ואין באמור להוות התחייבות לתוצאה עסקית כלשהי.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-neutral-dark mb-1.5">6. שינויים בתנאים</h2>
            <p>
              אנו עשויים לעדכן תנאים אלו מעת לעת, בהתאם להתפתחות המערכת. תאריך העדכון האחרון מופיע בראש העמוד.
              המשך שימוש במערכת לאחר עדכון מהווה הסכמה לתנאים המעודכנים.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-neutral-dark mb-1.5">7. יצירת קשר</h2>
            <p>
              לשאלות בנוגע לתנאי השימוש ניתן לפנות אלינו:{' '}
              <a href="mailto:deanhayke@gmail.com" className="text-primary hover:underline">deanhayke@gmail.com</a>
            </p>
          </section>

          <p className="pt-2">
            ראו גם את <Link href="/accessibility" className="text-primary hover:underline">הצהרת הנגישות</Link> שלנו.
          </p>
        </div>
      </div>
    </div>
  )
}
