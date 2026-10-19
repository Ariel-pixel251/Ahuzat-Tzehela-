# אחוזת צהלה – אתר פעילויות

אתר Next.js בעברית (RTL, מובייל קודם): לוח פעילויות והרשמה לפרויקטים, לאירועים, לשיעורים פרטיים ולהצעת הרצאות.

## הרצה מקומית

```bash
npm install
cp .env.example .env.local   # למלא ערכי Supabase, או להשאיר ריק לבדיקה
npm run dev
```

בלי משתני Supabase, במצב פיתוח ההרשמות מודפסות ללוג ולא נשמרות. בפרודקשן הטופס יחזיר שגיאה עד שיוגדרו.

## Supabase

1. ליצור פרויקט ב-Supabase.
2. להריץ את `supabase/schema.sql` ב-SQL Editor (טבלאות `signups`, `lecture_proposals` עם RLS שמאפשר רק הוספה).
3. להגדיר `SUPABASE_URL` ו-`SUPABASE_ANON_KEY` (Settings → API) ב-`.env.local` ובהגדרות הסביבה של האירוח.

את ההרשמות רואים ב-Table Editor של Supabase.

## פריסה

- **Netlify:** לחבר את הריפו (Add new site → Import from Git). Netlify מזהה Next.js אוטומטית (build: `npm run build`). להוסיף את שני משתני ה-Supabase תחת Site configuration → Environment variables.
- **Vercel:** לייבא את הריפו ולהוסיף את אותם משתני סביבה.

## עריכת תוכן

הפרויקטים והאירועים נמצאים ב-`lib/data.ts`. אירוע עם `tentative: true` מוצג עם תווית ״טרם אושר״.
