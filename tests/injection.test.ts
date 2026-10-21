import { beforeAll, describe, expect, test, vi } from "vitest";
import { parseIcs, type CalendarEvent } from "@/lib/calendar/parse";
import * as slots from "@/lib/db/slots";
import type { Db } from "@/lib/db/types";
import { testDb } from "./helpers/db";

// Classic SQL injection and XSS payloads go into every field and parameter of every public form
// (the real server actions, with the real validation and a real Postgres). Each answer must be a
// normal, friendly result: no database error leaks, nothing dropped, and nobody else's data back.

const PAYLOADS = [
  "' OR '1'='1",
  "' OR 1=1 --",
  "'; DROP TABLE digital_bookings;--",
  "\"; DROP TABLE students; --",
  "1 UNION SELECT phone FROM digital_bookings --",
  "' UNION SELECT name, phone, email FROM students --",
  "%27%20OR%20%271%27%3D%271",
  "&#39; OR &#39;1&#39;=&#39;1",
  "\\' OR \\'1\\'=\\'1",
  "'||(select pg_sleep(2))||'",
  "admin'--",
  "<script>alert(1)</script>",
  "\"><img src=x onerror=alert(document.cookie)>",
  "javascript:alert(1)",
  "${7*7}{{7*7}}",
  "\u0000\u001b[31m\r\nBcc: attacker@example.com",
  "a".repeat(5000),
];

// what must never appear in an answer shown to a person
const LEAK = /syntax error|relation "|column "|pg_|postgres|sqlstate|stack|at async|violates|duplicate key|\bselect\b.*\bfrom\b/i;

let db: Db;
let ip = 0;
let event: CalendarEvent;

vi.mock("next/headers", () => ({
  // a new address for every call, so the per-address rate limits don't hide what the validation does
  headers: async () => new Headers({ "x-forwarded-for": `10.0.${Math.floor(++ip / 250)}.${ip % 250}` }),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {}, getAll: () => [] }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` });
  },
}));
vi.mock("@/lib/db/client", () => ({ getDb: async () => db, databaseMode: () => "local" }));
vi.mock("@/lib/calendar", async (original) => {
  const actual = await original<typeof import("@/lib/calendar")>();
  const calendar = () => ({ all: [event], upcoming: [event], cancelled: [], source: "calendar" as const });
  return { ...actual, getCalendar: async () => calendar(), getEvent: async (key: string) => (key === event.key ? event : null) };
});
vi.mock("@/lib/auth/admin", async (original) => ({ ...(await original<typeof import("@/lib/auth/admin")>()), getAdmin: async () => null }));

const residents = await import("@/app/actions/residents");
const students = await import("@/app/actions/students");
const admin = await import("@/app/actions/admin");

const fd = (fields: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) f.append(k, x);
  return f;
};

async function tableCount() {
  const [row] = await db.query<{ n: number }>(`select count(*)::int as n from pg_tables where schemaname = 'public'`);
  return row.n;
}

let slotId: string;
let tables: number;

beforeAll(async () => {
  db = await testDb();
  const day = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10).replaceAll("-", "");
  event = parseIcs(
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:party-1@google.com",
      `DTSTART;TZID=Asia/Jerusalem:${day}T170000`,
      `DTEND;TZID=Asia/Jerusalem:${day}T190000`,
      "SUMMARY:Language night | ערב שפות [language-night]",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n"),
  ).events[0];
  slotId = (await slots.createSlot(db, {
    slot_date: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10),
    start_time: "16:00",
    end_time: "17:00",
    place_he: "בספרייה",
    place_en: null,
    resident_places: 50,
    helpers_needed: 2,
    note_en: null,
    note_he: null,
    booking_open: true,
    closes_hours_before: null,
  }))!;
  // someone else's booking, which no payload may reveal
  await slots.bookSlot(db, slotId, { name: "Secret Person", phone: "0529998877", email: "secret@example.com", needs: ["phone"], needs_other: null, registered_by: null });
  tables = await tableCount();
});

type Action = (s: null, f: FormData) => Promise<{ ok: boolean; message?: string; errors?: Record<string, string>; data?: unknown } | null>;

const FORMS: { name: string; action: Action; valid: () => Record<string, string | string[]> }[] = [
  {
    name: "resident: book digital support",
    action: residents.bookHelpSlot,
    valid: () => ({ slot: slotId, needs: ["phone"], needs_other: "", name: "Rivka Cohen", phone: `050${String(1000000 + ip).slice(-7)}`, email: "" }),
  },
  {
    name: "resident: register for an event",
    action: residents.registerResidentForEvent,
    valid: () => ({ event: event.key, attendees: "1", languages: ["he"], other_language: "", name: "Rivka", phone: `052${String(1000000 + ip).slice(-7)}`, email: "" }),
  },
  {
    name: "resident: podcast",
    action: residents.joinPodcastAsResident,
    valid: () => ({ topics: ["history"], language: "he", days: ["sun"], hours: "10:00-12:00", name: "Rivka", phone: `053${String(1000000 + ip).slice(-7)}`, email: "" }),
  },
  { name: "resident: call me back", action: residents.requestCallback, valid: () => ({ name: "Moshe", phone: "0541234567" }) },
  { name: "resident: report a problem", action: residents.reportProblemAsResident, valid: () => ({ message: "Something happened", name: "", phone: "" }) },
  { name: "resident: status lookup", action: residents.checkStatus, valid: () => ({ phone: "0529998877", code: "1234" }) },
  { name: "resident: cancel booking link", action: residents.cancelHelpByToken, valid: () => ({ token: "a".repeat(43) }) },
  { name: "resident: cancel registration link", action: residents.cancelRegistrationByToken, valid: () => ({ token: "a".repeat(43), locale: "he" }) },
  {
    name: "student: register for an event",
    action: students.registerStudentForEvent,
    valid: () => ({
      event: event.key,
      name: "Dana",
      email: `d${ip}@emis.test`,
      phone: "0501112233",
      attendees: "1",
      notes: "",
      languages: ["en"],
      other_language: "",
      preferred_language: "none",
      consent: "on",
    }),
  },
  {
    name: "student: podcast",
    action: students.joinPodcastAsStudent,
    valid: () => ({ name: "Dana", email: `p${ip}@emis.test`, phone: "", topics: ["music"], language: "en", availability: "", consent: "on" }),
  },
  { name: "student: sign-in link", action: students.requestSignInLink, valid: () => ({ name: "Dana", email: `s${ip}@emis.test`, phone: "", consent: "on" }) },
  { name: "student: report a problem", action: students.reportProblemAsStudent, valid: () => ({ message: "Help", name: "", contact: "", consent: "on" }) },
  { name: "student: pair request", action: students.askToPair, valid: () => ({ token: "a".repeat(43), target: slotId }) },
  { name: "student: volunteer", action: students.volunteerForSlotAction, valid: () => ({ slot: slotId }) },
];

describe("injection and XSS payloads in every field", () => {
  test("the valid version of each form is accepted (so the payloads below reach the database)", async () => {
    const accepted = FORMS.filter((f) => !/status lookup|link|pair request|volunteer/.test(f.name));
    for (const form of accepted) {
      const res = await form.action(null, fd(form.valid()));
      expect(res?.ok, `${form.name}: ${JSON.stringify(res)}`).toBe(true);
    }
  });

  for (const form of FORMS) {
    test(form.name, async () => {
      for (const field of Object.keys(form.valid())) {
        for (const payload of PAYLOADS) {
          const fields = { ...form.valid(), [field]: Array.isArray(form.valid()[field]) ? [payload] : payload };
          const res = await form.action(null, fd(fields));
          // random private-link tokens can contain any letters (e.g. "pg_"): leave them out of the check
          const shown = JSON.stringify(res ?? {}).replace(/token=[A-Za-z0-9_-]+/g, "token=…");
          expect(shown, `${form.name} / ${field}`).not.toMatch(LEAK);
          // nobody else's details come back
          expect(shown).not.toContain("0529998877");
          expect(shown).not.toContain("secret@example.com");
        }
      }
      expect(await tableCount()).toBe(tables);
    });
  }

  test("free text is stored exactly as typed (parameters, not SQL) and never executed", async () => {
    const payload = "'; DROP TABLE digital_bookings;-- <script>alert(1)</script>";
    const res = await residents.bookHelpSlot(null, fd({ slot: slotId, needs: ["other"], needs_other: payload, name: "Avi Cohen", phone: "0587654321", email: "" }));
    expect(res?.ok).toBe(true);
    const [row] = await db.query<{ needs_other: string }>(`select needs_other from digital_bookings where phone = '0587654321'`);
    expect(row.needs_other).toBe(payload);
    expect(await tableCount()).toBe(tables);
  });

  test("names only allow letters and name punctuation", async () => {
    const res = await residents.requestCallback(null, fd({ name: "<b>Moshe</b>", phone: "0541234567" }));
    expect(res?.ok).toBe(false);
    expect(res?.errors?.name).toBeTruthy();
  });

  test("unknown fields are rejected", async () => {
    const res = await residents.requestCallback(null, fd({ name: "Moshe", phone: "0541234567", is_admin: "true" }));
    expect(res?.ok).toBe(false);
  });

  test("the status lookup never matches with an injected code", async () => {
    for (const code of ["' OR '1'='1", "1234' OR 'x'='x", "%"]) {
      const res = await residents.checkStatus(null, fd({ phone: "0529998877", code }));
      expect(res?.ok).toBe(false);
      expect(JSON.stringify(res)).not.toContain("בספרייה");
    }
  });
});

describe("admin actions refuse anyone who isn't a signed-in admin", () => {
  const ACTIONS = Object.entries(admin).filter(([name]) => !["sendAdminLink", "devAdminLogin", "adminLogout"].includes(name));

  test("every admin action answers 'sign in' and changes nothing", async () => {
    expect(ACTIONS.length).toBeGreaterThan(20);
    const before = await db.query<{ n: number }>(`select (select count(*) from digital_slots) + (select count(*) from audit_log) + (select count(*) from blocked_contacts) as n`);
    for (const [name, action] of ACTIONS) {
      const res = await (action as Action)(null, fd({ id: slotId, slot: slotId, phone: "0529998877", email: "x@example.com", confirm: "on" }));
      expect(res, name).toMatchObject({ ok: false, message: "Please sign in again." });
    }
    const after = await db.query<{ n: number }>(`select (select count(*) from digital_slots) + (select count(*) from audit_log) + (select count(*) from blocked_contacts) as n`);
    expect(after[0].n).toBe(before[0].n);
    // the other person's booking is still there
    const [row] = await db.query<{ n: number }>(`select count(*)::int as n from digital_bookings where phone = '0529998877'`);
    expect(row.n).toBe(1);
  });
});
