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

## Still to do

- [ ] Confirm the live checks: a "צרו איתי קשר" request appears in Supabase → `callback_requests`;
      admin magic-link sign-in works; `/students/schedule` shows the live calendar (no yellow "offline" note).
- [ ] Email: create a Resend account, verify a domain/sender, add `RESEND_API_KEY` and `EMAIL_FROM` in
      Vercel, redeploy. Optionally use Resend as Supabase Auth's custom SMTP. Until then, emails are only logged.
- [ ] Add the events from `notes/meeting-notes.md` to the Google Calendar, with tags (README → "How to add an event").
      The seed file is only an offline fallback.
- [ ] Add leaders to `ADMIN_EMAILS` and to `/admin/leaders`.
- [ ] Try the resident portal with one or two real residents; screen-reader check.
- [ ] Choose an SMS/WhatsApp provider (resident messages are a manual queue in `/admin/messages` for now).

## Open questions

- Who are Yocopas and dp2? Who is the 15 December speaker, and what's the lecture's title
  ("To the Abyss and Back" is a working title)?
- The topic of Leah's lecture on International Holocaust Remembrance Day.
