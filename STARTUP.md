# הפעלת SH - Project Manager

## הפעלה ראשונה (כבר בוצע)
```
pnpm install
cd apps/api && npx prisma db push && npx tsx prisma/seed.ts
```

## הפעלה יומית — שתי טרמינלים

### טרמינל 1 — API (port 3002)
```
cd C:\deanreport\apps\api
npx tsx src/index.ts
```

### טרמינל 2 — Web (port 3003)
```
cd C:\deanreport\apps\web
npx next dev -p 3003
```

## גלישה
- http://localhost:3003 — ממשק המשתמש
- http://localhost:3002/health — בדיקת API

## כניסה לדמו
- owner@demo.com / Demo1234!
- pm@demo.com / Demo1234!
