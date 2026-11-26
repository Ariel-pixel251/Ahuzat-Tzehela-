import { beforeEach, describe, expect, test } from "vitest";
import * as events from "@/lib/db/events";
import { hitRateLimit, lookupStatus } from "@/lib/db/misc";
import * as podcast from "@/lib/db/podcast";
import * as slots from "@/lib/db/slots";
import { upsertStudent } from "@/lib/db/students";
import type { Db } from "@/lib/db/types";
import { testDb } from "./helpers/db";

let db: Db;
beforeEach(async () => {
  db = await testDb();
});


const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const slotInput = (over: Partial<slots.SlotInput> = {}): slots.SlotInput => ({
  slot_date: inDays(5),
  start_time: "16:00",
  end_time: "17:30",
  place_he: "בחדר הקהילה",
  place_en: "Community room",
  resident_places: 3,
  helpers_needed: 2,
  note_en: null,
  note_he: null,
  booking_open: true,
  closes_hours_before: 24,
  ...over,
});
const booking = (n: number, over: Partial<slots.BookingInput> = {}): slots.BookingInput => ({
  name: `Rivka Cohen ${n}`,
  phone: `050123456${n}`,
  email: null,
  needs: ["whatsapp"],
  needs_other: null,
  registered_by: null,
  ...over,
});

describe("podcast pairs", () => {
  const join = (name: string, portal: "student" | "resident", contact: string) =>
    podcast.joinPodcast(db, {
      name,
      email: contact.includes("@") ? contact : null,
      phone: contact.includes("@") ? null : contact,
      portal,
      topics: ["history"],
      language: "he",
      availability: null,
      registered_by: null,
    });

  test("makePair forms a pair; statuses go looking → paired", async () => {
    const s = (await join("Dana", "student", "dana@emis.test"))!;
    const r = (await join("Moshe Levi", "resident", "0521111111"))!;
    expect((await podcast.getParticipant(db, s.id))?.status).toBe("looking");
    expect(await podcast.makePair(db, s.id, r.id)).not.toBeNull();
    expect((await podcast.getParticipant(db, s.id))?.status).toBe("paired");
    expect((await podcast.getPartner(db, s.id))?.id).toBe(r.id);
  });

  test("a person belongs to at most one pair", async () => {
    const a = (await join("A", "student", "a@emis.test"))!;
    const b = (await join("B", "resident", "0521111112"))!;
    const c = (await join("C", "resident", "0521111113"))!;
    expect(await podcast.makePair(db, a.id, b.id)).not.toBeNull();
    expect(await podcast.makePair(db, a.id, c.id)).toBeNull();
    const results = await Promise.all([podcast.makePair(db, c.id, b.id), podcast.makePair(db, c.id, a.id)]);
    expect(results.every((r) => r === null)).toBe(true);
  });

  test("unpairing frees both people", async () => {
    const a = (await join("A", "student", "a@emis.test"))!;
    const b = (await join("B", "resident", "0521111112"))!;
    const c = (await join("C", "student", "c@emis.test"))!;
    const pairId = (await podcast.makePair(db, a.id, b.id))!;
    await podcast.unpair(db, pairId);
    const people = await podcast.listParticipants(db);
    expect(people.filter((p) => p.status !== "paired").map((p) => p.id).sort()).toEqual([a.id, b.id, c.id].sort());
  });

  test("the same email or phone can't sign up twice; anyone can pair, not only student+resident", async () => {
    await join("A", "student", "a@emis.test");
    expect(await join("A again", "student", "A@EMIS.test")).toBeNull();
    const x = (await join("X", "student", "x@emis.test"))!;
    const y = (await join("Y", "student", "y@emis.test"))!;
    expect(await podcast.makePair(db, x.id, y.id)).not.toBeNull();
  });

  test("withdrawing returns the partner to the list", async () => {
    const a = (await join("A", "student", "a@emis.test"))!;
    const b = (await join("B", "resident", "0521111112"))!;
    await podcast.makePair(db, a.id, b.id);
    await podcast.withdraw(db, a.id);
    const people = await podcast.listParticipants(db);
    expect(people.filter((p) => p.active && p.status !== "paired").map((p) => p.id)).toEqual([b.id]);
  });
});

describe("event registration capacity and waiting list", () => {
  const reg = (n: number, attendees = 1): events.RegistrationInput => ({
    event_key: "uid-1@google.com",
    event_title_en: "Hanukkah party",
    event_title_he: "מסיבת חנוכה",
    event_date: "2030-12-10",
    event_time: "17:00",
    kind: "general",
    portal: "resident",
    name: `Person ${n}`,
    phone: `05000000${String(n).padStart(2, "0")}`,
    email: null,
    attendees,
    notes: null,
    languages: [],
    other_language: null,
    preferred_language: null,
    registered_by: null,
  });

  test("people beyond the capacity go on the waiting list", async () => {
    expect((await events.registerForEvent(db, reg(1, 2), 3)).status).toBe("confirmed");
    expect((await events.registerForEvent(db, reg(2, 2), 3)).status).toBe("waitlist");
    expect((await events.registerForEvent(db, reg(3, 1), 3)).status).toBe("confirmed");
  });

  test("concurrent sign-ups never overshoot the capacity", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => events.registerForEvent(db, reg(i + 1), 5)));
    expect(results.filter((r) => r.status === "confirmed")).toHaveLength(5);
    expect(results.filter((r) => r.status === "waitlist")).toHaveLength(3);
  });

  test("cancelling promotes the earliest waiting people who fit", async () => {
    const first = await events.registerForEvent(db, reg(1, 2), 2);
    await events.registerForEvent(db, reg(2, 2), 2);
    await events.registerForEvent(db, reg(3, 1), 2);
    if (first.status === "duplicate") throw new Error();
    const promoted = await events.cancelRegistration(db, first.id, 2);
    expect(promoted.map((p) => p.name)).toEqual(["Person 2"]);
  });

  test("raising the capacity later moves people up (daily promotion)", async () => {
    await events.registerForEvent(db, reg(1, 2), 2);
    await events.registerForEvent(db, reg(2, 1), 2);
    await events.registerForEvent(db, reg(3, 1), 2);
    expect(await events.promoteWaitlist(db, "uid-1@google.com", 2)).toHaveLength(0);
    const promoted = await events.promoteWaitlist(db, "uid-1@google.com", 4);
    expect(promoted.map((p) => p.name).sort()).toEqual(["Person 2", "Person 3"]);
  });

  test("without a capacity everyone is confirmed; registering twice is a duplicate", async () => {
    for (let i = 1; i <= 5; i++) expect((await events.registerForEvent(db, reg(i), null)).status).toBe("confirmed");
    expect((await events.registerForEvent(db, reg(1), null)).status).toBe("duplicate");
  });

  test("registrations keep their snapshot and can be listed by event key", async () => {
    await events.registerForEvent(db, reg(1), null);
    const [row] = await events.listRegistrationsForEvent(db, "uid-1@google.com");
    expect(row).toMatchObject({ event_title_he: "מסיבת חנוכה", event_date: "2030-12-10", event_time: "17:00" });
  });
});

describe("tokens and request codes", () => {
  test("every booking gets a cancel token (for the confirmation screen), and only it finds the booking", async () => {
    const id = (await slots.createSlot(db, slotInput()))!;
    const withEmail = await slots.bookSlot(db, id, booking(1, { email: "r@example.com" }));
    const without = await slots.bookSlot(db, id, booking(2));
    if (withEmail.status !== "booked" || without.status !== "booked") throw new Error("not booked");
    expect(withEmail.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(without.token).not.toBe(withEmail.token);
    expect((await slots.getBookingByToken(db, withEmail.token))?.id).toBe(withEmail.id);
    expect((await slots.getBookingByToken(db, without.token))?.id).toBe(without.id);
    expect(await slots.getBookingByToken(db, "not-a-real-token")).toBeNull();
    expect(withEmail.code).toMatch(/^\d{4}$/);
  });

  test("a status lookup needs both the phone and the code", async () => {
    const id = (await slots.createSlot(db, slotInput()))!;
    const res = await slots.bookSlot(db, id, booking(1));
    if (res.status !== "booked") throw new Error("not booked");
    expect(await lookupStatus(db, "0501234561", res.code)).toHaveLength(1);
    expect(await lookupStatus(db, "0509999999", res.code)).toHaveLength(0);
    const wrong = res.code === "1000" ? "1001" : "1000";
    expect(await lookupStatus(db, "0501234561", wrong)).toHaveLength(0);
  });

  test("signing up again with the same email updates the name and keeps a phone number already given", async () => {
    await upsertStudent(db, { name: "Dana", email: "dana@emis.test", phone: "0501111111" });
    const again = await upsertStudent(db, { name: "Dana Cohen", email: "DANA@emis.test", phone: null });
    expect(again).toMatchObject({ name: "Dana Cohen", phone: "0501111111" });
  });
});

describe("misc", () => {
  test("rate limit allows up to max hits per window", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await hitRateLimit(db, "test:ip", 3, 60));
    expect(results).toEqual([true, true, true, false]);
  });
});
