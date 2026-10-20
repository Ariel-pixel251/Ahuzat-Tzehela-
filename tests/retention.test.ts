import { beforeEach, describe, expect, test } from "vitest";
import * as events from "@/lib/db/events";
import {
  clearCodeFailures,
  codeAttempt,
  createCallback,
  createProblemReport,
  deletePersonData,
  MAX_CODE_FAILURES,
  purgeOldData,
} from "@/lib/db/misc";
import * as podcast from "@/lib/db/podcast";
import * as slots from "@/lib/db/slots";
import { addStudentByAdmin, createLoginToken, exchangeLoginToken, getStudent, revokeStudent, saveProfile, upsertStudent } from "@/lib/db/students";
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
  test(`more than ${MAX_CODE_FAILURES} tries without a right code lock the phone; a right code clears the count`, async () => {
    const phone = "0501234567";
    for (let i = 0; i < MAX_CODE_FAILURES; i++) expect(await codeAttempt(db, phone)).toBe(true);
    await clearCodeFailures(db, phone);
    for (let i = 0; i < MAX_CODE_FAILURES; i++) expect(await codeAttempt(db, phone)).toBe(true);
    expect(await codeAttempt(db, phone)).toBe(false);
    expect(await codeAttempt(db, phone)).toBe(false);
    // other numbers are not affected
    expect(await codeAttempt(db, "0509999999")).toBe(true);
  });

  test("parallel tries can't get past the limit (the try is counted before the lookup)", async () => {
    const results = await Promise.all(Array.from({ length: 30 }, () => codeAttempt(db, "0507777777")));
    expect(results.filter(Boolean)).toHaveLength(MAX_CODE_FAILURES);
  });

  test("the lock ends after its time", async () => {
    const phone = "0501234567";
    for (let i = 0; i <= MAX_CODE_FAILURES; i++) await codeAttempt(db, phone);
    expect(await codeAttempt(db, phone)).toBe(false);
    await db.query(`update code_lockouts set locked_until = now() - interval '1 minute' where phone = $1`, [phone]);
    expect(await codeAttempt(db, phone)).toBe(true);
  });
});

describe("students: verification, blocking, retention", () => {
  test("before signing in, a later request's name replaces an earlier one; after, nobody can change it", async () => {
    await upsertStudent(db, { name: "Prank Name", email: "dana@emis.test", phone: null });
    const real = await upsertStudent(db, { name: "Dana Real", email: "dana@emis.test", phone: null });
    expect(real.name).toBe("Dana Real");
    await exchangeLoginToken(db, (await createLoginToken(db, real.id))!);
    expect((await upsertStudent(db, { name: "Prank Again", email: "DANA@emis.test", phone: null })).name).toBe("Dana Real");
  });

  test("blocking signs a student out and cancels their places", async () => {
    const s = await upsertStudent(db, { name: "Bad Actor", email: "bad@emis.test", phone: null });
    const session = (await exchangeLoginToken(db, (await createLoginToken(db, s.id))!))!;
    const id = (await slot(daysAgo(-3)))!;
    await slots.volunteer(db, id, s.id, { autoApprove: true });
    expect(await revokeStudent(db, { email: "BAD@emis.test", phone: null })).toBe(1);
    const { getStudentBySession } = await import("@/lib/db/students");
    expect(await getStudentBySession(db, session.token)).toBeNull();
    expect(await slots.listStudentSlots(db, s.id)).toHaveLength(0);
  });

  test("deleting a parent's data removes it from their child's profile", async () => {
    const s = await upsertStudent(db, { name: "Kid", email: "kid@emis.test", phone: null });
    await saveProfile(db, s.id, { phone: null, age_group: "under-18", guardian_name: "Parent", guardian_phone: "0546665544" });
    const result = await deletePersonData(db, "0546665544", null);
    expect(result.guardian_details).toBe(1);
    expect(await getStudent(db, s.id)).toMatchObject({ guardian_name: null, guardian_phone: null, age_group: null });
  });

  test("reports are matched by an email or phone typed inside the contact text", async () => {
    await createProblemReport(db, { portal: "student", name: null, contact: "email me: Dana@Emis.test please", message: "x" });
    await createProblemReport(db, { portal: "student", name: null, contact: "call 054-666-5544", message: "y" });
    await createProblemReport(db, { portal: "student", name: null, contact: "someone else", message: "z" });
    expect((await deletePersonData(db, "0546665544", "dana@emis.test")).problem_reports).toBe(2);
    expect(await count("problem_reports")).toBe(1);
  });

  test("students who aren't signed in and have no slot place are deleted after 30 days", async () => {
    const idle = await addStudentByAdmin(db, { name: "Idle", email: null, phone: null, added_by: "admin" });
    const placed = await addStudentByAdmin(db, { name: "Placed", email: null, phone: null, added_by: "admin" });
    const s = (await slot(daysAgo(-3)))!;
    await slots.volunteer(db, s, placed, { autoApprove: true });
    await db.query(`update students set created_at = now() - interval '31 days'`);
    await purgeOldData(db);
    expect(await getStudent(db, idle)).toBeNull();
    expect(await getStudent(db, placed)).not.toBeNull();
  });
});
