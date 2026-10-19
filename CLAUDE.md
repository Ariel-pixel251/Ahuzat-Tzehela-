# אחוזת צהלה – אתר פעילויות

## מטרה
אתר לפרויקט אחוזת צהלה: פעילויות, הרשמה והתאמה בין תלמידי EMIS לבין דיירי אחוזת צהלה.
מקור התוכן: `notes/meeting-notes.md`. הדרישות המלאות וההחלטות: `notes/brief.md`.
**מצב נוכחי (מה פרוס, מה נשאר): `notes/status.md` – לקרוא בתחילת כל עבודה ולעדכן בסופה.**

האתר החי: https://ahuzattzehela.vercel.app (Vercel, אזור Frankfurt; מסד נתונים Supabase ב-Frankfurt).
בעל הפרויקט אינו מתכנת: להסביר צעדים ידניים (Vercel, Supabase, GitHub) בצורה פשוטה, צעד אחר צעד.

## שני פורטלים, קוד אחד
- `/` – דף נחיתה עם שני כפתורים גדולים.
- `/students` – תלמידי EMIS. **אנגלית בלבד, משמאל לימין** (`lang="en" dir="ltr"`).
- `/residents` – דיירים. **עברית בלבד, מימין לשמאל** (`lang="he" dir="rtl"`), פשוט ככל האפשר.
- `/admin` – צוות ומנהיגים, באנגלית.
- טקסטים לא נכתבים בתוך רכיבים: `lib/i18n/en.ts` (תלמידים), `lib/i18n/he.ts` (דיירים).

## כללי עיצוב לפורטל הדיירים (גוברים על כל כלל אחר ב-`/residents`)
- עברית פשוטה וקצרה. בלי אנגלית, ז'רגון, קיצורים או אמוג'י שנושא משמעות לבד.
- דף הבית: 4–6 כפתורים גדולים מאוד (סמל + מילים, לפחות 72px). בלי תפריטים, בורר שפה או חלונות קופצים.
- בכל עמוד: "חזרה לדף הראשי", "הגדל טקסט" (נשמר בדפדפן), "בקשו שאתקשר אליכם".
- טקסט בסיס 22px ומעלה, כותרות 32px ומעלה, ריווח שורות 1.6, גופן Heebo, ניגודיות AAA, מטרות לחיצה 56px ומעלה.
- טפסים כאשף: שאלה אחת בכל מסך, "הבא"/"חזרה", "שלב 2 מתוך 4", כפתורי בחירה גדולים במקום רשימות נפתחות,
  מסך סיכום וכפתור אחד "אני מאשר/ת ושולח/ת". אחרי השליחה: אישור רגוע וקוד בקשה בן 4 ספרות.
- רק שם, טלפון (כל פורמט ישראלי) והבחירה עצמה. מייל לא חובה. הודעות שגיאה ידידותיות. שום דבר לא פג תוקף.
- תאריכים במילים ("יום שני, 1 בנובמבר, בשעה 17:30"), אף פעם לא בפורמט ISO.
- בלי חשבונות וסיסמאות לדיירים. בדיקות axe ו-Playwright ב-CI חייבות לעבור.

## כללים
- מובייל קודם.
- אין לשמור מפתחות/סיסמאות בריפו: `.env.local` (ב-.gitignore) והגדרות הסביבה. רשימה מלאה: `.env.example`.
- אירועים מגיעים רק מ-Google Calendar (פיד iCal ציבורי). לא מוסיפים אירועים בקוד;
  `data/events.seed.json` משמש רק כגיבוי כשהפיד לא זמין.
- פרטי קשר אף פעם לא מוצגים לציבור או לתלמידים אחרים; RLS סוגר את כל הטבלאות למפתח הציבורי.
- לפני PR: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`.
- עובדים בענפים (branch) ופותחים Pull Request; לא דוחפים ישירות ל-main.

## סטאק
Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres + RLS, Auth למנהלים), Resend (מייל),
Vercel (אירוח ו-cron יומי). מקומית: PGlite במקום Supabase, בלי הגדרות.

## ישויות
event_registrations (לפי UID של אירוע ביומן), digital_requests, students, podcast_participants/pairs,
lesson_topics/requests/matches, lecture_proposals, visit_requests, callback_requests, courses,
timetable_slots, announcements, leaders, leader_tasks, outbound_messages, settings.

## How to work on this project (for Claude)

### Map
| Area | Where |
| --- | --- |
| Landing, student portal, admin (English, LTR root layout) | `app/(en)/` (`page.tsx`, `students/`, `admin/`) |
| Resident portal (Hebrew, RTL root layout) | `app/(he)/residents/` |
| Server actions (validate with zod → honeypot → rate limit → `lib/domain.ts`) | `app/actions/{residents,students,admin}.ts` |
| Business rules shared by portals and admin (registration, claiming, pairing, notifications) | `lib/domain.ts` |
| SQL data access; every function takes a `Db` | `lib/db/*.ts`; connection in `lib/db/client.ts` |
| Schema, RLS, atomic SQL functions | `supabase/migrations/*.sql`; starter data `supabase/seed.sql` |
| Calendar: iCal parsing, tags/options, seed fallback, event health | `lib/calendar/` |
| Text (no strings hard-coded in components) | `lib/i18n/en.ts` (students), `lib/i18n/he.ts` (residents); admin pages are English inline |
| Editable lists | `config/languages.ts`, `config/options.ts` |
| Resident wizard and its steps | `components/Wizard.tsx`, `lib/wizard-steps.ts` |
| Student/admin forms | `components/forms.tsx` |
| Email + SMS/WhatsApp queue | `lib/notify/` |
| Tests | `tests/` (Vitest, PGlite with the real migrations), `e2e/` (Playwright + axe, fixture calendar) |

### Common changes
- **Wording:** edit `lib/i18n/he.ts` / `en.ts`; keep both portals' rules (Hebrew-only residents, English-only students).
- **New field on a form:** zod schema in the action → `lib/domain.ts` / `lib/db/*` → a **new migration** → the form
  (resident: a wizard step in `lib/wizard-steps.ts`; student: `components/students/*`) → admin list + CSV export → tests.
- **Database changes:** never edit `0001_init.sql`; add `supabase/migrations/000N_name.sql` (it's applied automatically
  to the local PGlite and tests). In the PR, tell the owner to paste it into Supabase → SQL Editor → Run **before merging**.
  New tables need `enable row level security` and the same revokes as the end of `0001_init.sql`.
- **New event tag/form:** `TAGS` and `eventForm()` in `lib/calendar/parse.ts`, `lib/event-links.ts`, README tag table.
- **Never** put user input into SQL text: always `$1, $2…` parameters. Never expose phone/email publicly.
- **JSON/array parameters:** pass `JSON.stringify(value)` as `$n::text::jsonb` (arrays through `text_array($n::text::jsonb)`),
  never `$n::jsonb`: postgres.js (production) would encode the string twice. `tests/postgres-driver.test.ts` runs the
  production driver against a local server to catch this kind of difference; add a case there for new query shapes.

### Before opening a PR
`npm run lint && npm run typecheck && npm test && npm run test:e2e` (the e2e tests start their own `next dev` on port
3100 with a fresh local database; stop other dev servers first). For UI changes, check the resident pages at 360px.
Vercel builds a preview for every PR; `main` deploys to production on merge. Update `notes/status.md` when setup or
status changes.

### Environment
Local: `npm install && npm run dev`, with no `.env.local` needed (PGlite in `.data/`, emails logged, "Dev sign-in" on
`/admin/login`). Production values live only in Vercel → Settings → Environment Variables (list in `.env.example`).

## שאלות פתוחות
- מי זה Yocopas ו-dp2? מי המרצה ב-15 בדצמבר ומה שם ההרצאה (שם עבודה: "אל התהום וחזרה")?
- נושא ההרצאה של לאה ביום השואה הבינלאומי.
- ספק SMS/וואטסאפ (כרגע הודעות לדיירים נשלחות ידנית מתוך `/admin/messages`).
