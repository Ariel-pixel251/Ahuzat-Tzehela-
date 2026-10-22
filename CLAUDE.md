# EMIS × אחוזת צהלה – אתר הפרויקט

## מטרה
אתר לפרויקט של תלמידי EMIS ודיירי אחוזת צהלה. **שלושה דברים בלבד:** אירועים (מ-Google Calendar, כולל ערב שפות
וערב משחקים), זוגות פודקאסט, וליווי דיגיטלי במועדים שהמנהלים קובעים. שם הפרויקט במקום אחד: `config/brand.ts`.
מקור התוכן: `notes/meeting-notes.md`. הדרישות וההחלטות: `notes/brief.md`. אבטחה: `SECURITY.md`.
**מצב נוכחי (מה פרוס, מה נשאר): `notes/status.md` – לקרוא בתחילת כל עבודה ולעדכן בסופה.**

האתר החי: https://beyachad-ledorot.vercel.app (הכתובת הישנה ahuzattzehela.vercel.app מפנה אליה; Vercel, אזור Frankfurt; מסד נתונים Supabase ב-Frankfurt).
בעל הפרויקט אינו מתכנת: להסביר צעדים ידניים (Vercel, Supabase, GitHub) בצורה פשוטה, צעד אחר צעד.

## שני פורטלים, קוד אחד
- `/` – דף נחיתה: שם הפרויקט ושני כפתורים גדולים.
- `/students` – תלמידי EMIS. **אנגלית בלבד, משמאל לימין** (`lang="en" dir="ltr"`).
- `/residents` – דיירים. **עברית בלבד, מימין לשמאל** (`lang="he" dir="rtl"`), פשוט ככל האפשר.
- `/admin` – צוות ומנהיגים, באנגלית.
- טקסטים לא נכתבים בתוך רכיבים: `lib/i18n/en.ts` (תלמידים), `lib/i18n/he.ts` (דיירים).

## כללי עיצוב לפורטל הדיירים (גוברים על כל כלל אחר ב-`/residents`)
- עברית פשוטה וקצרה. בלי אנגלית, ז'רגון, קיצורים או אמוג'י שנושא משמעות לבד.
- דף הבית: שם הפרויקט (בלי ברכה כמו "שלום, במה נוכל לעזור") ו-3 כפתורים גדולים מאוד (סמל + מילים, לפחות 72px):
  "מה קורה השבוע?", "עזרה עם הטלפון או המחשב", "פודקאסט". בלי תפריטים, בורר שפה או חלונות קופצים.
- בכל עמוד: הלוגואים (קישור לדף הראשי), "חזרה לדף הראשי", "הגדל טקסט" (נשמר בדפדפן).
- אין "צרו קשר" (הוסר לבקשת הבעלים): מייל הארגון מופיע רק בהודעת הפרטיות (`contactEmail` ב-`config/brand.ts`).
  "דיווח על בעיה" נשאר (בטיחות).
- טקסט בסיס 22px ומעלה, כותרות 32px ומעלה, ריווח שורות 1.6, גופן Heebo, ניגודיות AAA, מטרות לחיצה 56px ומעלה.
- טפסים כאשף: שאלה אחת בכל מסך, "הבא"/"חזרה", "שלב 2 מתוך 4", כפתורי בחירה גדולים במקום רשימות נפתחות,
  מסך סיכום וכפתור אחד "אני מאשר/ת ושולח/ת". אחרי השליחה: אישור רגוע וקוד בקשה בן 4 ספרות.
  בפודקאסט בוחרים אחד ממועדי הפודקאסט שהמנהלים יוצרים (`podcast_times`, כמו מועדי הליווי הדיגיטלי), או
  "אף מועד לא מתאים? שלחו לי הודעה ונתאם". זוג שבחר אותו מועד נפגש בו.
- רק שם, טלפון (כל פורמט ישראלי) והבחירה עצמה. מייל לא חובה. הודעות שגיאה ידידותיות. שום דבר לא פג תוקף.
- תאריכים במילים ("יום שני, 1 בנובמבר, בשעה 17:30"), אף פעם לא בפורמט ISO.
- בלי חשבונות וסיסמאות לדיירים. בדיקות axe ו-Playwright ב-CI חייבות לעבור.

## כללים
- מובייל קודם.
- אין לשמור מפתחות/סיסמאות בריפו: `.env.local` (ב-.gitignore) והגדרות הסביבה. רשימה מלאה: `.env.example`.
- אירועים מגיעים רק מ-Google Calendar (פיד iCal ציבורי). לא מוסיפים אירועים בקוד;
  `data/events.seed.json` משמש רק כגיבוי כשהפיד לא זמין.
- פרטי קשר אף פעם לא מוצגים לציבור או לתלמידים אחרים; RLS סוגר את כל הטבלאות למפתח הציבורי.
  מתנדב רואה שם פרטי וצורך רק של דיירים במועדים שלו, וטלפון רק אחרי קוד ההתנהגות ו-48 שעות לפני המועד.
- SQL רק עם פרמטרים (`$1, $2…`); כלל ESLint ו-`scripts/check-sql.mjs` נכשלים על SQL שנבנה מטקסט.
- לפני PR: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`.
- עובדים בענפים (branch) ופותחים Pull Request; לא דוחפים ישירות ל-main.

## סטאק
Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres + RLS, Auth למנהלים), Gmail SMTP או Resend (מייל),
Vercel (אירוח ו-cron יומי). מקומית: PGlite במקום Supabase, בלי הגדרות.

## ישויות
event_registrations (לפי UID של אירוע ביומן), podcast_times, digital_slots / digital_slot_series / digital_blocked_dates,
digital_bookings (דיירים), digital_volunteers (תלמידים), students, podcast_participants/pairs,
problem_reports, blocked_contacts, audit_log, code_lockouts, leaders, leader_tasks, outbound_messages, settings.
הוסרו (מחוץ לתחום): "צרו קשר"/בקשות שיחה חוזרת, שיעורים פרטיים, קורסים ומערכת שעות, בקשות ביקור, הצעות הרצאה, "זיכרון בסלון", הודעות באנר,
דף שיתוף/פוסטר, דף הרשמה מודפס.

## How to work on this project (for Claude)

### Map
| Area | Where |
| --- | --- |
| Landing, student portal, admin (English, LTR root layout) | `app/(en)/` (`page.tsx`, `students/`, `admin/`) |
| Resident portal (Hebrew, RTL root layout) | `app/(he)/residents/` |
| Server actions (honeypot → rate limit → strict zod → `lib/domain.ts`; admin: `asAdmin` + audit log) | `app/actions/{residents,students,admin}.ts` |
| Business rules shared by portals and admin (registration, claiming, pairing, notifications) | `lib/domain.ts` |
| SQL data access; every function takes a `Db` | `lib/db/*.ts`; connection in `lib/db/client.ts` |
| Schema, RLS, atomic SQL functions (booking, volunteering, pairing, retention) | `supabase/migrations/0001_init.sql`; `supabase/reset.sql` (one-time, old schema) |
| Podcast times (data / admin section / resident wizard step / student form) | `lib/db/podcast.ts`, `app/(en)/admin/(protected)/podcast/`, `lib/wizard-steps.ts` (`podcastSteps`), `components/students/PodcastSignup.tsx`; `supabase/migrations/0002_podcast_times.sql` |
| Digital support slots (data / admin page / resident wizard / student pages) | `lib/db/slots.ts`, `app/(en)/admin/(protected)/digital-support/`, `lib/wizard-steps.ts` (`helpSteps`), `app/(en)/students/{digital-support,mine}/` |
| Brand name, contact email (privacy page only), legal texts | `config/brand.ts`, `legal/*.md` (rendered by `components/Markdown.tsx`, `{{contact_email}}` filled in by `lib/legal.ts`), `LEGAL_TODO.md` |
| Logos (sizes, alt text), favicon, share image, email header | `config/logos.ts`, `components/Logos.tsx`, `public/logos/` (originals in `assets/logos/`), `scripts/make-brand-images.mjs`, `lib/site-metadata.ts`, `lib/notify/html.ts` |
| Security: CSP + admin guard, headers, logging, checks | `proxy.ts`, `next.config.ts`, `lib/log.ts`, `lib/admin-page.ts`, `scripts/check-*.mjs`, `SECURITY.md` |
| Calendar: iCal parsing, tags/options, seed fallback, event health | `lib/calendar/` |
| Text (no strings hard-coded in components) | `lib/i18n/en.ts` (students), `lib/i18n/he.ts` (residents); admin pages are English inline |
| Editable lists | `config/languages.ts`, `config/options.ts` |
| Resident wizard and its steps | `components/Wizard.tsx`, `lib/wizard-steps.ts` |
| Student/admin forms | `components/forms.tsx` |
| Email (SMTP e.g. Gmail app password, or Resend) + SMS/WhatsApp queue | `lib/notify/` |
| Tests | `tests/` (Vitest, PGlite with the real migrations; `rls`, `injection`, `slots`, `retention`, `security`), `e2e/` (Playwright + axe, fixture calendar) |

### Common changes
- **Wording:** edit `lib/i18n/he.ts` / `en.ts`; keep both portals' rules (Hebrew-only residents, English-only students).
- **New field on a form:** zod schema in the action (`form({...})` is strict: unknown fields are rejected, so the
  field must be added there) → `lib/domain.ts` / `lib/db/*` → a **new migration** → the form (resident: a wizard step
  in `lib/wizard-steps.ts`; student: `components/students/*`) → admin list + CSV export → tests (also add it to
  `tests/injection.test.ts`).
- **Database changes:** `0001_init.sql` was rewritten twice (scope change; then the owner had call-back requests removed,
  with `0003` doing the same on existing databases). From now on never edit it;
  add `supabase/migrations/000N_name.sql` (applied automatically to the local PGlite and tests). In the PR, tell the
  owner to paste it into Supabase → SQL Editor → Run **before merging**. New tables need `enable row level security`
  and the same revokes as the end of `0001_init.sql`; functions need `set search_path = public, pg_temp`
  (`tests/rls.test.ts` checks all of this). Personal data needs a retention rule in `purge_old_data()` and a line in
  `delete_person_data()`.
- **New event tag/form:** `TAGS` and `eventForm()` in `lib/calendar/parse.ts`, `lib/event-links.ts`, README tag table.
- **Never** put user input into SQL text: always `$1, $2…` parameters; no `${…}` or `+` in query text at all (lint
  error) — use a view or write the SQL out. Never expose phone/email publicly. Never log them (`logError` redacts).
- **Admin pages:** start with `await adminPage("view-name")` (server check + audit of views of personal data);
  admin actions use `asAdmin` and call `misc.audit(...)`, never with a person's phone or email.
- **JSON/array parameters:** pass `JSON.stringify(value)` as `$n::text::jsonb` (arrays through `text_array($n::text::jsonb)`),
  never `$n::jsonb` (a driver may encode the string twice). `tests/postgres-driver.test.ts` runs the
  production driver against a local server to catch this kind of difference; add a case there for new query shapes.

### Before opening a PR
`npm run lint && npm run typecheck && npm test && npm run test:e2e` (the e2e tests start their own `next dev` on port
3100 with a fresh local database; stop other dev servers first). For UI changes, check the resident pages at 360px.
Also `node scripts/check-sql.mjs`, and `npm run build && node scripts/check-client-bundle.mjs` (CI runs these, plus
`npm audit` and gitleaks). Vercel builds a preview for every PR; `main` deploys to production on merge. Update
`notes/status.md` when setup or status changes.

### Environment
Local: `npm install && npm run dev`, with no `.env.local` needed (PGlite in `.data/`, emails logged, "Dev sign-in" on
`/admin/login`). Production values live only in Vercel → Settings → Environment Variables (list in `.env.example`).
Read settings with `readEnv()` from `lib/env.ts` (it forgives pasted spaces/quotes), never `process.env.X` directly.
When something doesn't work on the live site, first ask the owner to sign in and open `/admin/setup` and send a
screenshot: it explains database, auth, email, cron, calendar and slot problems for that deployment
(`lib/setup-check.ts`; it opens without sign-in only while admin sign-in itself isn't set up).
A new migration file must also be added to the setup check (it should detect whether `0002…` etc. has been run).

## שאלות פתוחות
- מי זה Yocopas ו-dp2? מי המרצה ב-15 בדצמבר ומה שם ההרצאה (שם עבודה: "אל התהום וחזרה")?
- נושא ההרצאה של לאה ביום השואה הבינלאומי.
- ספק SMS/וואטסאפ (כרגע הודעות לדיירים נשלחות ידנית מתוך `/admin/messages`).
- נוסח הפרטיות ושם הארגון ומייל הקשר (`LEGAL_TODO.md`).
