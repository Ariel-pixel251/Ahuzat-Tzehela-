# Ahuzat Tzahala × EMIS

Website for the Ahuzat Tzahala project: activities, registration and matching between EMIS students
and the residents of Ahuzat Tzahala.

| Address | Who | Language |
| --- | --- | --- |
| `/` | Landing page: two big buttons | both |
| `/students` | EMIS students | English, left to right |
| `/residents` | Residents (many are elderly) | Hebrew only, right to left, very simple |
| `/admin` | Project team and leaders | English |

**Stack:** Next.js (App Router) + TypeScript + Tailwind CSS · Supabase (Postgres, RLS, Auth for admins) ·
Resend (email) · Vercel (hosting and daily cron) · Google Calendar (public iCal feed) for events.

## Features

- **Timetable** from Google Calendar: an agenda by month for students, a simple list of big cards for
  residents, a large-print printable sign-up sheet with a QR code.
- **Event registration** for every tagged event: capacity with an automatic waiting list, deadlines,
  confirmation and a reminder the day before. Registrations keep a snapshot of the event, so they survive
  calendar edits. Cancelled, removed or moved events are flagged for admins, and one click notifies everyone.
- **Language night** (languages spoken), **game night** (play in my preferred language), **memory in the
  living room** (host / share / attend / help).
- **Podcast pairs**: sign up, a "looking for a partner" list, request → accept, or admins pair people.
  One pair per person.
- **Digital support (ליווי דיגיטלי)**: residents ask for help in a 5-step wizard. Students take a request;
  double-claiming is impossible. Contact details are shown only to the assigned student, after the code of
  conduct. Optional leader approval of each match.
- **Private lessons**, **lecture proposals**, **visit requests**, **call-me-back**, a status page
  (phone + 4-digit code), courses and weekly timetable, announcements, share and invite page with QR poster.
- **Admin**: dashboard, lists with CSV export, register-on-behalf, sign-up sheet generator, leaders and
  tasks, content editing, and a queue of text messages to send by hand.

## Run it locally

Requirements: Node.js 22.

```bash
npm install
cp .env.example .env.local   # optional: everything works without values
npm run dev                  # http://localhost:3000
```

With no environment values:

- the database is a local Postgres (PGlite) in `.data/pglite`, migrated and seeded automatically;
- emails are printed in the terminal, and student sign-in links appear on screen;
- `/admin/login` shows a **Dev sign-in** button (never available in production);
- events come from the public Google Calendar feed, or `data/events.seed.json` if it can't be reached.

## Environment variables

| Variable | Secret? | Where to get it |
| --- | --- | --- |
| `GOOGLE_CALENDAR_ICS_URL` | no | Google Calendar → calendar settings → *Public address in iCal format*. Defaults to the Ahuzat Tzahala Events calendar. |
| `DATABASE_URL` | **yes** | Supabase → your project → **Connect** → *Transaction pooler* connection string (port 6543), with the database password. |
| `NEXT_PUBLIC_SUPABASE_URL` | no | Supabase → Project Settings → API → Project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no (public by design) | Supabase → Project Settings → API → `anon` key. Every table is closed to it. |
| `ADMIN_EMAILS` | no | Comma-separated emails allowed into `/admin` (admins and leaders). |
| `SITE_URL` | no | The site's public address, e.g. `https://ahuzat-tzahala.vercel.app`. |
| `RESEND_API_KEY` | **yes** | resend.com → API Keys. |
| `EMAIL_FROM` | no | A sender on a domain verified in Resend, e.g. `Ahuzat Tzahala <noreply@example.org>`. |
| `CRON_SECRET` | **yes** | Any long random string (e.g. `openssl rand -hex 32`). |

Never commit `.env.local`; it is gitignored.

## Tests

```bash
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm test              # Vitest: calendar parsing, claiming, pairing, waiting list, tokens/codes, phones, CSV
npm run test:e2e      # Playwright: resident flows, a student flow, axe accessibility, 360px and 200% zoom
```

The database tests run against the real migrations in an in-memory Postgres (PGlite), so the SQL that prevents
double assignment and double pairing is what's tested. The end-to-end tests start `next dev` with a fresh local
database and a fixture calendar (`e2e/fixtures/calendar.ics`). GitHub Actions runs all of this on every pull
request (`.github/workflows/ci.yml`).

To refresh the screenshots in `docs/screenshots`: `SCREENSHOTS=1 npx playwright test screenshots`.

## Supabase setup

1. Create a project at supabase.com (region: Frankfurt or closest).
2. **SQL Editor** → paste and run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql`.
   (Or with the Supabase CLI: `supabase link` then `supabase db push`, then run the seed.)
3. **Authentication → URL Configuration**: set *Site URL* to your site, and add
   `https://<your-site>/admin/auth/callback` to *Redirect URLs*.
4. **Authentication → Email**: the built-in email service is fine to start (it is rate-limited). For
   reliability, set Resend as custom SMTP.
5. Copy the connection string and API keys into the environment variables above.

**How data is protected.** The site's server talks to Postgres directly through `DATABASE_URL`, as the
privileged role (the equivalent of the service-role key), and never from the browser. Row Level Security is
enabled on every table with no policies for the public roles, and their privileges are revoked. Nothing,
including contact details, can be read or written with the public anon key. Public sign-ups go through
server code that validates input (zod), checks the honeypot and rate-limits. Students and residents only
ever see what the server chooses to show them (for example first names on the public boards).

## Deploy to Vercel

1. vercel.com → **Add New Project** → import this GitHub repository (framework: Next.js, defaults are fine).
2. **Settings → Environment Variables**: add every variable from the table above (Production and Preview).
3. Deploy. `vercel.json` schedules `/api/cron/daily` every day at 06:00 UTC (08:00/09:00 in Israel):
   reminders for tomorrow's events, then the data retention clean-up. Vercel sends `CRON_SECRET` automatically.
4. Put the production address in `SITE_URL` and in Supabase's redirect URLs.

## How to add an event

1. Open **Google Calendar** and pick the **"Ahuzat Tzahala Events"** calendar.
2. Add the event. Title format: **`English title | כותרת בעברית`**.
3. In the description, write the English text, then a line with only `---`, then the Hebrew text.
4. Add a **tag** to the title or description so the right registration button appears (see below).
5. Save. The event appears on the site within about **10 minutes**.

Students see the English part; residents see the Hebrew part. Without `|` or `---`, both portals show the
same text. Tags and options are removed from the text people see. Recurring events, all-day and multi-day
events, and times (shown in Israel time) all work. Cancelling or deleting an event in the calendar keeps
its registrations and flags it in the admin dashboard.

| Tag | What it does |
| --- | --- |
| `[language-night]` | Registration with the languages people speak |
| `[game-night]` | Registration with "play with someone who speaks my preferred language" |
| `[memorial]` | Registration with a role (residents: host / share a memory / listen; students: attend / help) |
| `[lecture]` `[party]` `[visit]` `[register]` | Standard registration (name, phone, email, number of people, notes) |
| `[podcast]` | A button to the podcast sign-up |
| `[digital-support]` | A button to digital support (residents: ask for help; students: the open requests) |
| *(no tag)* | Shown in the timetable without a button (the admin dashboard lists these) |

| Option (in the description) | Example | What it does |
| --- | --- | --- |
| `[capacity: N]` | `[capacity: 30]` | At most N people; then new registrations go on the waiting list, and are moved up automatically when someone cancels |
| `[closes: YYYY-MM-DD]` | `[closes: 2026-11-10]` | Last day to register (registration also closes when the event starts) |
| `[languages]` | | Adds the "languages I speak" question to any event |
| `[tbc]` or `TBC` | | Shows "Details coming soon" / "פרטים בקרוב" |

Example title: `Hanukkah party | מסיבת חנוכה [party]`; example description:
`Candle lighting and sufganiyot [capacity: 40]` / `---` / `הדלקת נרות וסופגניות`.

If the feed can't be fetched, the site shows `data/events.seed.json` (the events from the meeting notes)
instead of crashing. Those events are never shown while the feed works.

## Editing lists

- **Languages** (all language dropdowns and buttons): `config/languages.ts`. Add `{ code, en, he }`; don't
  change the `code` of a language people have already chosen.
- **Podcast topics, digital-support needs, days, projects, memorial roles**: `config/options.ts`.
- **Lesson topics, courses, weekly timetable, announcements, leaders and tasks**: in `/admin`, no code needed.
- **Text on the site**: `lib/i18n/en.ts` (students) and `lib/i18n/he.ts` (residents).

## Design rules for the resident portal

These rules win over anything else for `/residents`:

- Hebrew only, right to left. Short, plain everyday words; no English, jargon, abbreviations or emoji-only meaning.
- Home: 4–6 very large buttons (icon + words, at least 72px high), nothing else competing for attention.
  No menus, dropdown navigation, language switcher, footer clutter or popups.
- Every page: "חזרה לדף הראשי" at the top, "הגדל טקסט" (remembered in the browser) and "בקשו שאתקשר אליכם".
- Base text 22px (27px with bigger text), headings 32px+, line height 1.6, Heebo font, WCAG AAA contrast,
  no light grey text, tap targets of at least 56px, a thick visible focus ring.
- Forms are wizards: one question per screen, big "הבא"/"חזרה" buttons, "שלב 2 מתוך 4", big choice
  buttons instead of dropdowns, a review screen, and one final button "אני מאשר/ת ושולח/ת" with one privacy
  sentence. Then a calm confirmation with a 4-digit request code.
- Ask only for what's needed: name, phone (any Israeli format is accepted and normalised) and the choice.
  Email is optional. Friendly error messages, never walls of red. Nothing times out or clears a form.
- Dates in words ("יום שני, 1 בנובמבר, בשעה 17:30"), never ISO dates.
- No accounts or passwords. Changes go through a phone call (request code), or an email link if they gave
  an email. Staff can register residents on their behalf, including from the paper sign-up sheet.
- Checked automatically: axe (WCAG 2.1 AA + AAA contrast) on every resident page, no horizontal scroll
  at 360px and at 200% zoom, the full flows with Playwright, including keyboard only.

## Project layout

```
app/(en)/            landing page, /students, /admin (English, LTR root layout)
app/(he)/residents/  resident portal (Hebrew, RTL root layout)
app/actions/         server actions: validation, honeypot, rate limit, then lib/domain
app/api/cron/daily   reminders and data retention (Vercel Cron)
components/          shared UI: Wizard, forms, cards, icons
config/              editable lists (languages, topics, needs…)
lib/calendar/        iCal parsing (ical.js), seed fallback, event health
lib/db/              SQL data access (Supabase Postgres in production, PGlite locally/tests)
lib/domain.ts        business rules shared by both portals and the admin screens
lib/i18n/            English and Hebrew text, date formatting
lib/notify/          email (Resend) and the SMS/WhatsApp provider abstraction (manual queue for now)
supabase/            migrations and seed data
tests/, e2e/         Vitest and Playwright
```
