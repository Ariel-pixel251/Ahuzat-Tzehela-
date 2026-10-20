# EMIS × Ahuzat Tzahala

Website for the project of EMIS students and the residents of Ahuzat Tzahala: **events**, **podcast pairs**
and **digital support (ליווי דיגיטלי)**. The name lives in one place: `config/brand.ts`.

| Address | Who | Language |
| --- | --- | --- |
| `/` | Landing page: the project's name and two big buttons | both |
| `/students` | EMIS students | English, left to right |
| `/residents` | Residents (many are elderly) | Hebrew only, right to left, very simple |
| `/admin` | Project team and leaders | English |

**Stack:** Next.js (App Router) + TypeScript + Tailwind CSS · Supabase (Postgres, RLS, Auth for admins) ·
Gmail (SMTP) or Resend for email · Vercel (hosting and daily cron) · Google Calendar (public iCal feed) for events.

## Features

1. **Events** from Google Calendar: an agenda for students, big cards for residents. Registration for every
   tagged event, with capacity and an automatic waiting list, deadlines, a confirmation and a reminder the day
   before. **Language night** asks for the languages people speak; **game night** offers "play with someone who
   speaks my language". Registrations keep a snapshot of the event (by iCal UID), so they survive calendar edits;
   cancelled or moved events are flagged for admins, and one click notifies everyone.
2. **Podcast pairs**: sign up, a "looking for a partner" list, request → accept, or admins pair people. One pair
   per person. Admins can also pair people who never signed up (typed in on the form), set when and where they
   first meet, and send both a message with their partner and the time.
3. **Digital support** as admin-set time slots: admins create slots (one-off or weekly, with blocked dates for
   holidays), residents book a place in a 4-step wizard, students volunteer as helpers. No overbooking (the database
   locks the slot while counting). Students see only the first name and need of residents in **their** slots, and the
   phone number only after the code of conduct and within 48 hours before the slot. Reminders the day before, and
   notices when a slot changes or is cancelled. Admins can add a student who hasn't signed up and email them the slot.

Around them: **call me back** (name and phone, shown to admins), **report a problem** on both portals,
a status page for residents (phone + 4-digit code), **register a resident on their behalf**, **leaders and tasks**,
a queue of text messages to send by hand, CSV exports, an audit log, blocking a person and deleting all data for a
person.

## Run it locally

Requirements: Node.js 22.

```bash
npm install
cp .env.example .env.local   # optional: everything works without values
npm run dev                  # http://localhost:3000
```

With no environment values:

- the database is a local Postgres (PGlite) in `.data/pglite`, created from `supabase/migrations/` automatically
  (if you had a local database from before the 2026 rewrite, delete the `.data` folder);
- emails are printed in the terminal, and student sign-in links appear on screen;
- `/admin/login` shows a **Dev sign-in** button (never available in production);
- events come from the public Google Calendar feed, or `data/events.seed.json` if it can't be reached.

## Environment variables

| Variable | Secret? | Where to get it |
| --- | --- | --- |
| `GOOGLE_CALENDAR_ICS_URL` | no | Google Calendar → calendar settings → *Public address in iCal format*. Defaults to the project's events calendar. |
| `DATABASE_URL` | **yes** | Supabase → **Connect** → **Direct** tab → Method: *Transaction pooler* (port 6543), with the database password. |
| `NEXT_PUBLIC_SUPABASE_URL` | no | Supabase → **Connect** → Framework → Next.js (or Project Settings → API). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | no (public by design) | Same place; starts with `sb_publishable_`. Every table is closed to it. |
| `ADMIN_EMAILS` | no | Comma-separated emails allowed into `/admin` (admins and leaders). |
| `STUDENT_EMAIL_DOMAINS` | no | Recommended: only these email domains can sign in as students, e.g. `em-is.org`. |
| `SITE_URL` | no | The site's public address, e.g. `https://beyachad-ledorot.vercel.app`. |
| `SMTP_USER` | no | **Email, easiest option (free, no domain):** a Gmail address. |
| `SMTP_PASSWORD` | **yes** | That account's **app password**: Google Account → Security → 2-Step Verification (turn on) → App passwords. |
| `SMTP_HOST`, `SMTP_PORT` | no | Only for non-Gmail mailboxes (port defaults to 465). |
| `RESEND_API_KEY` | **yes** | Alternative to SMTP: resend.com → API Keys (needs a domain you can verify). |
| `EMAIL_FROM` | no | Sender name/address. Optional with Gmail; required with Resend. |
| `CRON_SECRET` | **yes** | Any long random string (e.g. `openssl rand -hex 32`). |

The site never uses Supabase's service-role key. Never commit `.env.local`; it is gitignored. Settings changed in
Vercel only apply after **Deployments → ⋯ → Redeploy**.

**Something not working on the live site?** Sign in and open **`/admin/setup`**
(`https://beyachad-ledorot.vercel.app/admin/setup`). It checks the database, admin sign-in, admin emails, email,
the daily job, the calendar and the digital-support slots, and says in plain words what to fix. While admin sign-in
itself isn't set up, the page opens without signing in.

## Tests

```bash
npm run lint          # ESLint, including the rule that forbids SQL built from strings
npm run typecheck     # TypeScript
npm test              # Vitest: calendar, slots (no overbooking, weekly series, the 48-hour contact rule),
                      #   waiting lists, retention, code lockout, roles and RLS, SQL-injection/XSS payloads
                      #   through every form, and the production database driver against a local server
npm run test:e2e      # Playwright: resident, student and admin flows, axe accessibility, security headers
node scripts/check-sql.mjs                                # no SQL from strings, no dynamic SQL in migrations
npm run build && node scripts/check-client-bundle.mjs     # no secrets in the files sent to browsers
```

The database tests run the real migrations in an in-memory Postgres (PGlite). The end-to-end tests start
`next dev` with a fresh local database and a fixture calendar (`e2e/fixtures/calendar.ics`). GitHub Actions runs
all of this on every pull request, plus `npm audit` and a gitleaks scan of the whole git history
(`.github/workflows/ci.yml`). See [SECURITY.md](SECURITY.md).

To refresh the screenshots in `docs/screenshots`: `SCREENSHOTS=1 npx playwright test screenshots`.

## Supabase setup

1. Create a project at supabase.com with region **Central EU (Frankfurt)**, the closest to Israel.
2. **SQL Editor** → paste and run `supabase/migrations/0001_init.sql`.
   A database made before the 2026 rewrite needs `supabase/reset.sql` first (it deletes the old tables and their
   data); `/admin/setup` says when that's needed.
3. **Authentication → URL Configuration**: set *Site URL* to your site, and add
   `https://<your-site>/admin/auth/callback` to *Redirect URLs*.
4. **Authentication → Email → SMTP Settings**: give Supabase the same mailbox the site uses (with Gmail: host
   `smtp.gmail.com`, port 465, username and sender = the Gmail address, password = the app password). Supabase's
   built-in email only sends a few emails per hour, and only to members of your Supabase organisation.
5. Turn on two-factor login for your Supabase account.

**How data is protected:** see [SECURITY.md](SECURITY.md). In short: only the server talks to the database, every
table is closed to Supabase's public roles, all SQL uses bind parameters, every input is validated, admins are
checked on the server for every page and action, and personal data is deleted on a schedule.

## Deploy to Vercel

1. vercel.com → **Add New Project** → import this GitHub repository (framework: Next.js).
2. **Settings → Environment Variables**: add every variable from the table above.
3. Deploy. `vercel.json` runs the site in Frankfurt (`fra1`), next to the database, and schedules
   `/api/cron/daily` every day at 06:00 UTC: reminders for tomorrow's events and slots, waiting-list promotion, then
   the data retention clean-up. Vercel sends `CRON_SECRET` automatically.
4. Put the production address in `SITE_URL` and in Supabase's redirect URLs.

## Digital support slots

In `/admin` → **Digital support**:

- **Create slots**: date, start and end time, place (written the way residents read it, e.g. "בחדר הקהילה"),
  resident places, student helpers needed, optional notes, and when booking closes (e.g. 24 hours before).
  Tick **Repeat every week** and give a last date for a weekly series (up to 60 weeks).
- Each slot can be edited or cancelled on its own; a weekly series can be cancelled from a date on. Changing
  the date, time or place, or cancelling, tells everyone booked into the slot.
- **Blocked dates** (holidays): no slots are created on them, and blocking a date cancels its slots.
- Move bookings or helpers between slots, add a helper (also a student who hasn't signed up), cancel a booking.
- **Settings**: a leader approves each helper (off by default); how many hours before a slot students can cancel.

## How to add an event

1. Open **Google Calendar** and pick the project's events calendar.
2. Add the event. Title format: **`English title | כותרת בעברית`**.
3. In the description, write the English text, then a line with only `---`, then the Hebrew text.
4. Add a **tag** to the title or description so the right registration button appears (see below).
5. Save. The event appears on the site once Google updates the public feed (usually minutes, sometimes a few hours)
   plus up to about 10 minutes for the site's own refresh.

Students see the English part; residents see the Hebrew part. Tags and options are removed from the text people see.
Recurring, all-day and multi-day events all work (times in Israel time). Calendar text is treated as untrusted:
HTML is turned into plain text.

| Tag | What it does |
| --- | --- |
| `[language-night]` | Registration with the languages people speak |
| `[game-night]` | Registration with "play with someone who speaks my preferred language" |
| `[party]` `[lecture]` `[register]` | Standard registration (name, phone, email, number of people, notes) |
| `[podcast]` | A button to the podcast sign-up |
| *(no tag)* | Shown without a button (the admin dashboard lists these) |

| Option (in the description) | Example | What it does |
| --- | --- | --- |
| `[capacity: N]` | `[capacity: 30]` | At most N people; then a waiting list, moved up automatically when someone cancels |
| `[closes: YYYY-MM-DD]` | `[closes: 2026-11-10]` | Last day to register (registration also closes when the event starts) |
| `[languages]` | | Adds the "languages I speak" question to any event |
| `[tbc]` or `TBC` | | Shows "Details coming soon" / "פרטים בקרוב" |

If the feed can't be fetched, the site shows `data/events.seed.json` instead of crashing (without registration).

## Editing lists and text

- **The project's name and subtitle**: `config/brand.ts`.
- **Languages**: `config/languages.ts`. **Podcast topics, digital-support needs, age groups, projects**: `config/options.ts`.
- **Text on the site**: `lib/i18n/en.ts` (students) and `lib/i18n/he.ts` (residents).
- **Privacy notices** (drafts): `legal/privacy-students.en.md` and `legal/privacy-residents.he.md`; see `LEGAL_TODO.md`.
- **Leaders and tasks, slots, blocked dates**: in `/admin`, no code needed.

## Design rules for the resident portal

These rules win over anything else for `/residents`:

- Hebrew only, right to left. Short, plain everyday words; no English, jargon, abbreviations or emoji-only meaning.
- Home: the project's name, then 4 very large buttons (icon + words, at least 72px high): events, digital support,
  podcast, contact me. No menus, language switcher or popups.
- Every page: "חזרה לדף הראשי", "הגדל טקסט" (remembered in the browser) and "בקשו שאתקשר אליכם".
- Base text 22px (27px with bigger text), headings 32px+, line height 1.6, Heebo font, WCAG AAA contrast, tap
  targets of at least 56px, a thick visible focus ring.
- Forms are wizards: one question per screen, big "הבא"/"חזרה" buttons, "שלב 2 מתוך 4", big choice buttons instead
  of dropdowns (exception at the owner's request: hour scroll wheels in the podcast form), a review screen, and one
  final button "אני מאשר/ת ושולח/ת" with one privacy sentence. Then a calm confirmation with a 4-digit request code.
- Only name, phone and the choice; email is optional. Friendly error messages. Nothing times out.
- Dates in words ("יום שלישי, 3 בנובמבר, 16:00 עד 17:30"), never ISO dates.
- No accounts or passwords. Checked automatically: axe on every resident page, no horizontal scroll at 360px and
  at 200% zoom, the full flows with Playwright, including keyboard only.

## Project layout

```
app/(en)/            landing page, /students, /admin (English, LTR root layout)
app/(he)/residents/  resident portal (Hebrew, RTL root layout)
app/actions/         server actions: validation, honeypot, rate limit, then lib/domain
app/api/cron/daily   reminders and data retention (Vercel Cron)
components/          shared UI: Wizard, forms, cards, icons; admin/ for the admin forms
config/              brand name and editable lists
legal/               privacy notices (Markdown, rendered by the site)
lib/calendar/        iCal parsing (ical.js), seed fallback, event health
lib/db/              SQL data access (Supabase Postgres in production, PGlite locally/tests)
lib/domain.ts        business rules shared by both portals and the admin screens
lib/i18n/            English and Hebrew text, date formatting
lib/notify/          email (SMTP/Resend) and the manual SMS/WhatsApp queue
proxy.ts             Content Security Policy and the admin guard
scripts/             CI security checks (SQL, browser bundle)
supabase/            the schema (one migration) and a one-time reset script
tests/, e2e/         Vitest and Playwright
```
