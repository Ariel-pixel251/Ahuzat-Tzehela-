# Project brief and decisions

The final brief (it replaces earlier instructions) and how it was implemented. The source notes are
in `meeting-notes.md`.

## The brief, in short

- **Two portals, one codebase.** `/students` for EMIS students (English, LTR) and `/residents` for residents
  (Hebrew, RTL, as simple as possible for elderly people). `/` has two big buttons. `/admin` for the team.
- **Events come only from Google Calendar** (public iCal feed). Bilingual titles `English | עברית`,
  descriptions split by `---`, tags such as `[game-night]` choose the registration form, options
  `[capacity: N]`, `[closes: date]`, `[languages]`. Registrations are linked by iCal UID (plus occurrence
  date for recurring events) and keep a snapshot of the event.
- **Features:** event registration (capacity, waiting list, deadline), language night, game night, podcast
  pairs, digital support (resident request → student takes it), private lessons, lecture proposals, visit
  requests, memory in the living room, courses and timetable, announcements, share and invite, call-me-back.
- **Admin:** Supabase Auth magic link with an allowlist, CSV exports, register-on-behalf, printable sign-up
  sheet, leaders and tasks, dashboard.
- **Notifications:** Resend email, a manual SMS/WhatsApp queue for residents, reminders the day before.
- **Privacy:** contact details never public; RLS; data deleted 90 days after the event.

## Decisions

- No passwords for registrations. Students: name + email (a magic link to sign in for digital support and
  a private link for the podcast page). Residents: name + phone, email optional, a 4-digit request code.
  Only admins have a real login.
- Resident portal Hebrew-only; student portal English-only; admin English-only.
- "TBC" in the notes shows as "Details coming soon" / "פרטים בקרוב".
- Registrations are deleted 90 days after the event; cancelled requests are deleted by the daily job.
- SMS/WhatsApp is a queue in the admin area ("messages to send by hand") until a provider is chosen.
- The server reaches the database through a direct, server-only Postgres connection (`DATABASE_URL`) rather
  than the service-role REST key. Same privilege model; it lets the claiming, pairing and waiting-list rules
  live in atomic SQL functions that the tests run for real, and lets the site run locally without any setup.
- RLS is stricter than "public can only insert": the public API roles can't do anything, and every insert
  goes through validated, rate-limited server code.
- The status page needs the phone **and** the code, never the code alone, and is rate-limited.
- Residents pair for the podcast through the team (students request, the team confirms by phone).
  Students use a private page to request and accept pairs.
- Private lessons: residents say what they want to learn, students what they can teach; admins match them.
- The resident home page has exactly the six buttons from the brief; lessons, courses, request status and
  privacy are small text links under them.
- Seed events (offline fallback only): 1 Nov 17:30 board games night; 16 Nov 18:30 language night;
  10 Dec Hanukkah party; 14–15 Dec Yocopas visit (TBC); 15 Dec lecture "To the Abyss and Back" (working
  title, TBC, possibly with dp2 students); 27 Jan International Holocaust Remembrance Day (memory in the
  living room; Leah's English lecture, topic TBC).

## Still open

- Who are Yocopas and dp2? Who is the 15 December speaker, and what is the lecture's title?
- The topic of Leah's lecture.
- Which SMS/WhatsApp provider to use.
- Add the seed events to the Google Calendar (the feed is the only source when it works).
