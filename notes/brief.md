# Project brief and decisions

The current brief (the October 2026 "scope change + security fix", which overrides the earlier master brief
where they conflict) and how it was implemented. The source notes are in `meeting-notes.md`.

## The brief, in short

- **Only three features:** events from Google Calendar (registration, language night, game night),
  podcast pairs, and digital support as **admin-set time slots**.
- **Kept around them:** the two portals (students English LTR; residents Hebrew RTL, very simple), the admin
  area, leaders and tasks, register-a-resident-on-their-behalf, "call me back", email notifications,
  "report a problem".
- **Removed:** visit requests, courses and the school timetable page, private lessons, share/invite page and
  QR poster, lecture proposals, "memory in the living room", the announcements banner, the paper sign-up sheet.
- **Branding:** "EMIS × אחוזת צהלה" / "EMIS × Ahuzat Tzahala" as the main heading (in `config/brand.ts`), with the
  subtitle "פודקאסט, ליווי דיגיטלי ואירועים - ביחד" / "Podcast, digital support and events, together".
  No generic greeting.
- **Digital support slots:** admins create, edit, cancel, repeat weekly and block dates; residents book in a
  wizard (time → need → name and phone → review); students volunteer; no overbooking; contact details only for
  the student's own slots, after the code of conduct and within 48 hours; confirmations, reminders, change notices.
- **Security and privacy hardening:** parameterised SQL only (with a lint rule), strict server-side validation,
  injection and role tests, RLS deny-by-default, CSP and security headers, CSRF, rate limits, code lockout,
  admin checks everywhere with an audit log, safe errors and logs, email header safety, Dependabot/npm audit/
  gitleaks, retention, "delete all data for a person", draft privacy notices, code of conduct, report a problem,
  blocking, guardian details for under-18 volunteers.

## Decisions

- Digital support is slot-based only; the old open request list (residents ask, students take) is removed.
- Resident lectures, the memory sign-up, announcements and paper sign-up sheets were removed as outside the
  three kept features.
- "Call me back" stays, as part of helping residents, but only as a name and phone request.
- Phone is the main contact for residents; email is optional.
- The schema was rewritten as one clean `0001_init.sql` (no real data yet); `supabase/reset.sql` removes the old
  tables once.
- The server reaches the database through `DATABASE_URL` (server-only), not a service-role REST key; RLS is
  stricter than "public can only insert": the public API roles can't do anything.
- The page that explains setup problems (`/admin/setup`) needs an admin, except while admin sign-in itself isn't
  configured (it's how the owner fixes that).
- Admin sessions last 12 hours; student sessions 30 days.
- The 4-digit code: the phone number is the second factor; 5 wrong codes lock that phone for 24 hours.
- Retention: event registrations 90 days after the event, slots and bookings 90 days after the slot, cancelled
  sign-ups and call-backs 30 days, problem reports 1 year, audit log 2 years.
- Students who volunteer give an age group; under-18s also a parent or guardian's name, phone and okay.
- Admins can make podcast pairs and add slot helpers with people who never signed up (typed in by staff), and
  can send them a "who and when" message (owner's request).
- The podcast wizard keeps the hour scroll wheels (owner's request, an exception to "big buttons only").
- Seed events (offline fallback only) come from the meeting notes; they never open registration.

## Still open

- Who are Yocopas and dp2? Who is the 15 December speaker, and what is the lecture's title?
- The topic of Leah's lecture.
- Which SMS/WhatsApp provider to use.
- The organisation name and contact email for the privacy notices (`LEGAL_TODO.md`).
