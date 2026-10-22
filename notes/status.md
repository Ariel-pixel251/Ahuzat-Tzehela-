# Project status

Where the project stands, so the next session (human or Claude) can pick up from here.
Update this file whenever something is set up, changed or decided. **Never write passwords, keys or
connection strings here**; they live only in Vercel and in `.env.local`.

_Last updated: 2026-10-20_

## Live

| What | Where |
| --- | --- |
| Site | https://beyachad-ledorot.vercel.app (Vercel project `ahuzat_tzehela`, Hobby plan); the old `ahuzattzehela.vercel.app` should redirect here |
| Admin | https://beyachad-ledorot.vercel.app/admin (magic link to emails in `ADMIN_EMAILS`) |
| Code | GitHub `Ariel-pixel251/Ahuzat-Tzehela-`, branch `main`; Vercel deploys `main` automatically |
| Database | Supabase project in **Central EU (Frankfurt)**, `eu-central-1` (the earlier Tokyo project was replaced) |
| Server region | Vercel `fra1` (Frankfurt), set in `vercel.json`, next to the database |
| Events | Google Calendar "Ahuzat Tzahala Events", public iCal feed (default in `lib/calendar/index.ts`) |

Neither Vercel nor Supabase has an Israeli region; Frankfurt is the closest.

## Done

- Site built and merged (PR #1): student portal, resident portal, admin, calendar, tests, CI.
- Supabase (Frankfurt): the old schema was run (before the October 2026 rewrite; see "Still to do").
- Vercel environment variables set: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ADMIN_EMAILS`, `CRON_SECRET`, `SITE_URL`.
- Supabase Auth: Site URL and the redirect URL `https://beyachad-ledorot.vercel.app/admin/auth/callback` (keep the old
  `https://ahuzattzehela.vercel.app/admin/auth/callback` until the new one is confirmed working).
- Address changed to `https://beyachad-ledorot.vercel.app` (2026-10-20). Needs `SITE_URL` = that address in Vercel, the Supabase
  Site URL/redirect above, and a redeploy. Use only this address on posters, QR codes and messages.
- Podcast times (owner's request, 2026-10-22, replacing the hour scroll wheels): the admin creates them on
  /admin → Podcast (once or weekly, with a number of pairs); residents and students choose one when they sign up,
  or "arrange by message". A pair who chose the same time meets then. Needs `0002_podcast_times.sql` run in Supabase.

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
- Admin pages hung on "Loading…" (and forms said "not available") because postgres.js sends a query with
  values in two steps (describe + Flush, then execute), and Supabase's transaction pooler doesn't pass the
  Flush on, so every query with values waited forever (queries without values, like the setup check's, worked).
  Switched to node-postgres (`pg`), which sends each query in one go; the connection is now encrypted (TLS).
  `tests/postgres-driver.test.ts` puts a stand-in pooler that drops Flush in front of a real Postgres in CI.

- Admin sign-in links weren't sent and forms said "Sign-ups are not available" when the deployment couldn't
  reach the database (e.g. `DATABASE_URL` missing for that environment, or not redeployed). Admin sign-in no
  longer depends on the database, settings are read forgivingly, and **`/admin/setup`** explains what's wrong.
- Supabase's built-in email only sends to members of the Supabase organisation, a few per hour: sign in to
  Supabase with the admin email, or set Resend as custom SMTP.

## Scope change (October 2026, PR after #8)

The site now has only events, podcast pairs and digital support **slots** (see `notes/brief.md`). The database
schema was rewritten, so the live database must be reset once (no real data yet).

## Still to do

- [ ] **Before merging the scope-change PR:** Supabase → SQL Editor → run `supabase/reset.sql` (deletes the old
      tables), then run `supabase/migrations/0001_init.sql`. Then merge; `/admin/setup` should be all green.
- [ ] Create the digital support slots in `/admin` → Digital support (weekly series + holiday dates).
- [ ] Turn on two-factor login on GitHub, Vercel, Supabase (and Resend if used).
- [ ] Fill in the organisation name and contact email in `legal/` and work through `LEGAL_TODO.md`; get the
      school's okay before real users sign up.
- [ ] Set `STUDENT_EMAIL_DOMAINS=em-is.org` in Vercel (only school emails can sign in as students).
- [ ] Email: `SMTP_USER` / `SMTP_PASSWORD` (Gmail app password) in Vercel and the same in Supabase's custom SMTP.
- [ ] Keep the Google Calendar public; add the events from `notes/meeting-notes.md` with tags (README).
- [ ] Add leaders to `ADMIN_EMAILS` and to `/admin/leaders`.
- [ ] Try the resident portal with one or two real residents; screen-reader check.
- [ ] Choose an SMS/WhatsApp provider (resident messages are a manual queue in `/admin/messages` for now).

## Open questions

- Who are Yocopas and dp2? Who is the 15 December speaker, and what's the lecture's title
  ("To the Abyss and Back" is a working title)?
- The topic of Leah's lecture on International Holocaust Remembrance Day.
