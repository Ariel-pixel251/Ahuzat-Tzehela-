import { beforeEach, describe, expect, test } from "vitest";
import * as events from "@/lib/db/events";
import {
  clearCodeFailures,
  codeLocked,
  createCallback,
  createProblemReport,
  deletePersonData,
  MAX_CODE_FAILURES,
  purgeOldData,
  recordCodeFailure,
} from "@/lib/db/misc";
import * as podcast from "@/lib/db/podcast";
import * as slots from "@/lib/db/slots";
import { upsertStudent } from "@/lib/db/students";
import type { Db } from "@/lib/db/types";
import { testDb } from "./helpers/db";

let db: Db;
beforeEach(async () => {
  db = await testDb();
});

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const count = async (table: string) => {
  const allowed = ["event_registrations", "digital_slots", "digital_bookings", "callback_requests", "podcast_participants", "students", "problem_reports", "outbound_messages"];
  if (!allowed.includes(table)) throw new Error("unknown table");
  // the table name comes from the fixed list above, never from input
  const [row] = await db.query<{ n: number }>(
    {
      event_registrations: "select count(*)::int as n from event_registrations",
      digital_slots: "select count(*)::int as n from digital_slots",
      digital_bookings: "select count(*)::int as n from digital_bookings",
      callback_requests: "select count(*)::int as n from callback_requests",
      podcast_participants: "select count(*)::int as n from podcast_participants",
      students: "select count(*)::int as n from students",
      problem_reports: "select count(*)::int as n from problem_reports",
      outbound_messages: "select count(*)::int as n from outbound_messages",
    }[table]!,
  );
  return row.n;
};

const registration = (date: string, phone: string): events.RegistrationInput => ({
  event_key: `uid-${date}@google.com`,
  event_title_en: "Party",
  event_title_he: "מסיבה",
  event_date: date,
  event_time: "17:00",
  kind: "general",
  portal: "resident",
  name: "Sara Levi",
  phone,
  email: null,
  attendees: 1,
  notes: null,
  languages: [],
  other_language: null,
  preferred_language: null,
  registered_by: null,
});

const slot = (date: string) =>
  slots.createSlot(db, {
    slot_date: date,
    start_time: "10:00",
    end_time: "11:00",
    place_he: "בספרייה",
    place_en: null,
    resident_places: 5,
    helpers_needed: 1,
    note_en: null,
    note_he: null,
    booking_open: true,
    closes_hours_before: null,
  });

describe("retention (daily clean-up)", () => {
  test("event registrations go 90 days after the event; cancelled ones after 30 days", async () => {
    await events.registerForEvent(db, registration(daysAgo(91), "0501111111"), null);
    await events.registerForEvent(db, registration(daysAgo(89), "0502222222"), null);
    const cancelled = await events.registerForEvent(db, registration(daysAgo(-10), "0503333333"), null);
    if (cancelled.status === "duplicate") throw new Error("duplicate");
    await events.cancelRegistration(db, cancelled.id, null);
    await db.query(`update event_registrations set cancelled_at = now() - interval '31 days' where id = $1`, [cancelled.id]);
    const result = await purgeOldData(db);
    expect(result.event_registrations).toBe(2);
    expect(await count("event_registrations")).toBe(1);
  });

  test("slots, with their bookings, go 90 days after the slot; cancelled bookings after 30 days", async () => {
    const old = (await slot(daysAgo(91)))!;
    const recent = (await slot(daysAgo(10)))!;
    await db.query(
      `insert into digital_bookings (slot_id, name, phone, code) values ($1, 'A', '0501111111', '1234'), ($2, 'B', '0502222222', '1234')`,
      [old, recent],
    );
    await db.query(
      `insert into digital_bookings (slot_id, name, phone, code, status, cancelled_at)
       values ($1, 'C', '0503333333', '1234', 'cancelled', now() - interval '31 days')`,
      [recent],
    );
    await purgeOldData(db);
    expect(await count("digital_slots")).toBe(1);
    const left = await db.query<{ name: string }>(`select name from digital_bookings`);
    expect(left.map((b) => b.name)).toEqual(["B"]);
  });

  test("call-back requests go after 30 days", async () => {
    await createCallback(db, { name: "Old", phone: "0501111111", registered_by: null });
    await createCallback(db, { name: "New", phone: "0502222222", registered_by: null });
    await db.query(`update callback_requests set created_at = now() - interval '31 days' where name = 'Old'`);
    await purgeOldData(db);
    expect(await count("callback_requests")).toBe(1);
  });
});

describe("delete all data for a person", () => {
  test("removes every record with the phone or email, and nothing else", async () => {
    const phone = "0547770000";
    await events.registerForEvent(db, registration(daysAgo(-5), phone), null);
    await events.registerForEvent(db, registration(daysAgo(-6), "0500000001"), null);
    const s = (await slot(daysAgo(-3)))!;
    await slots.bookSlot(db, s, { name: "Sara", phone, email: "sara@example.com", needs: [], needs_other: null, registered_by: null });
    await podcast.joinPodcast(db, { name: "Sara", email: null, phone, portal: "resident", topics: [], language: "he", availability: null, registered_by: null });
    await createCallback(db, { name: "Sara", phone, registered_by: null });
    await upsertStudent(db, { name: "Sara", email: "sara@example.com", phone: null });
    await createProblemReport(db, { portal: "resident", name: "Sara", contact: phone, message: "help" });

    const result = await deletePersonData(db, phone, "SARA@example.com");
    expect(result).toMatchObject({ event_registrations: 1, digital_bookings: 1, podcast_participants: 1, callback_requests: 1, students: 1, problem_reports: 1 });
    expect(await count("event_registrations")).toBe(1); // the other person's
    expect(await count("digital_bookings")).toBe(0);
    expect(await count("students")).toBe(0);
  });

  test("with neither phone nor email, nothing is deleted", async () => {
    await createCallback(db, { name: "X", phone: "0501111111", registered_by: null });
    expect(await deletePersonData(db, null, null)).toEqual({});
    expect(await count("callback_requests")).toBe(1);
  });
});

describe("4-digit code lockout", () => {
  test(`${MAX_CODE_FAILURES} wrong codes lock the phone number; a right code before that clears the count`, async () => {
    const phone = "0501234567";
    for (let i = 0; i < MAX_CODE_FAILURES - 1; i++) await recordCodeFailure(db, phone);
    expect(await codeLocked(db, phone)).toBe(false);
    await clearCodeFailures(db, phone);
    for (let i = 0; i < MAX_CODE_FAILURES - 1; i++) await recordCodeFailure(db, phone);
    expect(await codeLocked(db, phone)).toBe(false);
    await recordCodeFailure(db, phone);
    expect(await codeLocked(db, phone)).toBe(true);
    // other numbers are not affected
    expect(await codeLocked(db, "0509999999")).toBe(false);
  });

  test("the lock ends after its time", async () => {
    const phone = "0501234567";
    for (let i = 0; i < MAX_CODE_FAILURES; i++) await recordCodeFailure(db, phone);
    await db.query(`update code_lockouts set locked_until = now() - interval '1 minute' where phone = $1`, [phone]);
    expect(await codeLocked(db, phone)).toBe(false);
    await recordCodeFailure(db, phone);
    expect(await codeLocked(db, phone)).toBe(false);
  });
});
