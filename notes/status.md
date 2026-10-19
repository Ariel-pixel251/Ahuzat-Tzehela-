# Project status

Where the project stands, so the next session (human or Claude) can pick up from here.
Update this file whenever something is set up, changed or decided. **Never write passwords, keys or
connection strings here**; they live only in Vercel and in `.env.local`.

_Last updated: 2026-10-19_

## Live

| What | Where |
| --- | --- |
| Site | https://ahuzattzehela.vercel.app (Vercel project `ahuzat_tzehela`, Hobby plan) |
| Admin | https://ahuzattzehela.vercel.app/admin (magic link to emails in `ADMIN_EMAILS`) |
| Code | GitHub `Ariel-pixel251/Ahuzat-Tzehela-`, branch `main`; Vercel deploys `main` automatically |
| Database | Supabase project in **Central EU (Frankfurt)**, `eu-central-1` (the earlier Tokyo project was replaced) |
| Server region | Vercel `fra1` (Frankfurt), set in `vercel.json`, next to the database |
| Events | Google Calendar "Ahuzat Tzahala Events", public iCal feed (default in `lib/calendar/index.ts`) |

Neither Vercel nor Supabase has an Israeli region; Frankfurt is the closest.

## Done

- Site built and merged (PR #1): student portal, resident portal, admin, calendar, tests, CI.
- Supabase (Frankfurt): `supabase/migrations/0001_init.sql` and `supabase/seed.sql` run.
- Vercel environment variables set: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ADMIN_EMAILS`, `CRON_SECRET`, `SITE_URL`.
- Supabase Auth: Site URL and the redirect URL `https://ahuzattzehela.vercel.app/admin/auth/callback`.
- Resident time choice (PR #6): "from"/"until" scroll wheels (08:00–20:00, half hours) or "send me a
  message and we'll arrange a time". Stored in the existing `preferred_parts` column as `["10:00-12:00"]` or
  `["contact"]`; no database change.

## Lessons from the first deploy

- Vercel had the project as framework "Other" (it was created before the code existed), so the build
  looked for a `public` folder. Fixed in the dashboard (Framework Preset → Next.js) and now pinned with
  `"framework": "nextjs"` in `vercel.json`.
- `CRON_SECRET` must have no spaces or line breaks; Vercel refuses to build otherwise. The same goes for
  every pasted value (a stray space in `DATABASE_URL` breaks the database connection).
- In the Supabase "Connect" window, `DATABASE_URL` is under the **Direct** tab → Method **Transaction
  pooler** (port 6543). The Framework tab only has the URL and the publishable key.
- The first live form submission failed with "cannot extract elements from a scalar": the production driver
  (postgres.js) double-encoded JSON parameters bound as `$n::jsonb`. Fixed by binding them as `$n::text::jsonb`;
  `tests/postgres-driver.test.ts` now runs the production driver against a local server.

- Admin sign-in links weren't sent and forms said "Sign-ups are not available" when the deployment couldn't
  reach the database (e.g. `DATABASE_URL` missing for that environment, or not redeployed). Admin sign-in no
  longer depends on the database, settings are read forgivingly, and **`/admin/setup`** explains what's wrong.
- Supabase's built-in email only sends to members of the Supabase organisation, a few per hour: sign in to
  Supabase with the admin email, or set Resend as custom SMTP.

## Still to do

- [ ] Run `supabase/migrations/0002_promote_waitlist.sql` in Supabase → SQL Editor (daily waiting-list promotion).
- [ ] Open `/admin/setup` on the live site and fix anything red or yellow.
- [ ] Protect residents' phone numbers: set `STUDENT_EMAIL_DOMAINS` (school email domain) in Vercel, or turn on
      leader approval in `/admin` → Digital support.

- [ ] Confirm the live checks: a "צרו איתי קשר" request appears in Supabase → `callback_requests`;
      admin magic-link sign-in works; `/students/schedule` shows the live calendar (no yellow "offline" note).
- [ ] Email (no domain needed): create a Gmail account for the project, turn on 2-Step Verification, create an
      app password, add `SMTP_USER` and `SMTP_PASSWORD` in Vercel, redeploy, check `/admin/setup`. Use the same
      Gmail as Supabase Auth's custom SMTP for admin sign-in emails. (Resend still works if a domain is available;
      the school's em-is.org can't be used without its IT team.)
- [ ] Set `STUDENT_EMAIL_DOMAINS=em-is.org` in Vercel (only school emails can sign in as students).
- [ ] Add the events from `notes/meeting-notes.md` to the Google Calendar, with tags (README → "How to add an event").
      The seed file is only an offline fallback.
- [ ] Add leaders to `ADMIN_EMAILS` and to `/admin/leaders`.
- [ ] Try the resident portal with one or two real residents; screen-reader check.
- [ ] Choose an SMS/WhatsApp provider (resident messages are a manual queue in `/admin/messages` for now).

## Open questions

- Who are Yocopas and dp2? Who is the 15 December speaker, and what's the lecture's title
  ("To the Abyss and Back" is a working title)?
- The topic of Leah's lecture on International Holocaust Remembrance Day.
