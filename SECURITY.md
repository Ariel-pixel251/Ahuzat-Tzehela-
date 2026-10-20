# Security

This site holds names and phone numbers of elderly residents and of school students, some under 18.
Please treat any weakness as urgent.

## Reporting a problem

- **Something on the site (a bug, a leak, a worry about a person):** use **"Report a problem"** in
  either portal (`/students/report`, `/residents/report`). Only the admins see these reports.
- **A security weakness:** please don't open a public GitHub issue. Email the project owner (the
  address is in the privacy notice) with what you found and how to reproduce it. We aim to answer
  within 3 days.

## How the site protects data

| Area | What we do |
| --- | --- |
| Database access | Only the site's server talks to the database (`DATABASE_URL`). Row Level Security is on for every table with no policies, and Supabase's public roles (`anon`, `authenticated`) have no rights on any table, view or function; tests prove this (`tests/rls.test.ts`). No service-role key is used, and CI checks that no secret reaches the browser files (`scripts/check-client-bundle.mjs`). |
| SQL injection | All SQL uses bind parameters (`$1, $2…`). An ESLint rule (`local/no-sql-interpolation`) and `scripts/check-sql.mjs` fail the build on SQL built with `${…}` or `+`. Database functions have a fixed `search_path`, no `SECURITY DEFINER` and no dynamic SQL from input. `tests/injection.test.ts` sends classic SQL injection and XSS payloads to every form field; `e2e/security.spec.ts` to URL parameters. |
| Input | Every form and URL value is checked on the server with zod (`lib/validation.ts`): strict schemas (unknown fields rejected), length limits, allowed characters for names, choice lists, Israeli/international phone normalisation, emails, UUIDs, tokens, dates. |
| Output | React escapes all text. Calendar events are untrusted: HTML is turned into plain text when the feed is read. The legal pages are rendered from Markdown into React elements (no raw HTML; only http(s)/mailto links). No `dangerouslySetInnerHTML` with data (lint rule). |
| Headers | A Content Security Policy with a per-request nonce (`proxy.ts`): only the site's own scripts run, no framing, forms post only to the site. HSTS, `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `X-Frame-Options` (`next.config.ts`). |
| CSRF | All changes go through Next.js server actions, which check the request's origin; cookies are `SameSite=Lax`, `HttpOnly` and `Secure`. |
| Admins | Supabase Auth magic link, only for emails in `ADMIN_EMAILS`; sessions end 12 hours after signing in. Every admin page, action and CSV export checks the admin on the server (and `proxy.ts` turns others away first). Views of personal data, exports and every change are recorded in the audit log (`/admin/audit`) — without phone numbers or emails. |
| Students | Magic-link sign-in (school email domains via `STUDENT_EMAIL_DOMAINS`). A student sees only the first name and need of residents booked into their own slots, and the phone number only after accepting the code of conduct and only from 48 hours before the slot (enforced in the database query). Under-18s need a parent or guardian's name, phone and okay before volunteering. |
| Residents | No accounts. A 4-digit request code plus the phone number shows a request's status; 5 wrong codes lock that phone number for 24 hours, and lookups are rate-limited. Edit links use 256-bit random tokens (only their hashes are stored). |
| Abuse | Honeypot field and per-address rate limits on every form and lookup. Admins can block a phone or email. |
| Email | Fixed templates; every value is cleaned of line breaks and control characters, so names or event titles can't add email headers. |
| Errors and logs | People see friendly messages only. Server logs never include phone numbers or emails (`lib/log.ts` removes them). |
| Retention | A daily job deletes event registrations 90 days after the event, slots and bookings 90 days after the slot, cancelled sign-ups and call-back requests after 30 days. Admins can delete everything about a person in one step. |
| Supply chain | Dependabot (weekly), `npm audit` in CI (production dependencies must have no high or critical issues), gitleaks over the whole git history. |

## Known, accepted findings

- `npm audit` reports a high-severity issue in `braces` (GHSA-vfj7-8cjw-p6xm), pulled in only by the
  development linter (`eslint-config-next`). No fixed version exists yet; it never runs in production
  and only handles the project's own file patterns. Dependabot will pick up a fix.
- Inline `style` attributes are allowed by the CSP (`style-src 'unsafe-inline'`): React sets a few,
  and styles can't run code. Scripts are nonce-only.
