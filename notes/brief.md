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
- **Branding (v2, 2026-10-22, replaces the "EMIS × …" heading):** the site is the **EMIS branch** of the larger
  organisation "ביחד לדורות" (Together for Generations), in partnership with Ahuzat Tzahala, and must never look
  like the whole organisation's website. The organisation's logo always comes with the branch label "סניף EMIS" /
  "EMIS Branch" (`components/BrandLockup.tsx`, a test checks every page); EMIS and Ahuzat Tzahala appear smaller
  as partners. Footer disclaimer (wording to be confirmed). Names and wording in `config/brand.ts`. No greeting.
- **Digital support slots:** admins create, edit, cancel, repeat weekly and block dates; residents book in the
  two-screen sign-up (slot, then name and phone); students sign up on the slot card; no overbooking; students
  never see residents' phone numbers (the day-before email has first names and needs only); confirmations,
  reminders, change notices.
- **Simple sign-up (2026-11, owner's request):** the admins create the slots; residents and students just pick
  one, and nobody phones anyone to arrange anything. Every resident sign-up (podcast, digital help, events) is
  the same two screens: "מתי נוח לך?" (big slot buttons, full and past ones hidden; events skip it), then
  "איך קוראים לך ומה מספר הטלפון?" (the chosen slot with "לשנות", name, phone, at most one extra row with
  the usual answer chosen, "להירשם"). Then "נרשמת! ✓", the code (only needed to cancel) and a cancel button.
  No dropdowns, no email, nothing expires; a repeat sign-up shows the same success. Students sign up inside
  the card with no account (school email is the identity check) and cancel with the link in their email.
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
- Admin sessions last 12 hours. Students have no accounts or sessions any more (2026-11); the old session tables
  stay unused (nothing destructive).
- The 4-digit code: the phone number is the second factor; 5 wrong codes lock that phone for 24 hours.
- Retention: event registrations 90 days after the event, slots and bookings 90 days after the slot, cancelled
  sign-ups 30 days, problem reports 1 year, audit log 2 years.
- Students who volunteer say whether they're under 18; under-18s also give a parent or guardian's name and phone.
  One checkbox agrees to both the privacy notice and the code of conduct (`/students/code-of-conduct`).
- Admins can make podcast pairs and add slot helpers with people who never signed up (typed in by staff), and
  can send them a "who and when" message (owner's request).
- Podcast times are set by the admins, like digital support slots (owner's request, 2026-10-22; this replaced the
  hour scroll wheels). Since 2026-11: once or weekly, places for residents and for students, open/close, cancel
  (tells everyone). A time for one resident and one student pairs them automatically; otherwise the admin pairs
  people within the time. "Arrange by message" was removed; older sign-ups without a time show as "no time chosen".
  Residents don't choose a topic (chosen together at the meeting); students choose one.
- Seed events (offline fallback only) come from the meeting notes; they never open registration.

## Still open

- Who are Yocopas and dp2? Who is the 15 December speaker, and what is the lecture's title?
- The topic of Leah's lecture.
- Which SMS/WhatsApp provider to use.
- The organisation name and contact email for the privacy notices (`LEGAL_TODO.md`).
