import { beforeEach, describe, expect, test } from "vitest";
import { listMessages } from "@/lib/db/misc";
import * as slots from "@/lib/db/slots";
import { acceptConduct, upsertStudent } from "@/lib/db/students";
import type { Db } from "@/lib/db/types";
import { blockDateAndCancel, bookDigital, cancelSlotAndNotify, updateSlotAndNotify, volunteerForSlot } from "@/lib/domain";
import { setSetting } from "@/lib/db/misc";
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
  resident_places: 2,
  helpers_needed: 1,
  note_en: null,
  note_he: null,
  booking_open: true,
  closes_hours_before: 24,
  ...over,
});
const booking = (n: number, over: Partial<slots.BookingInput> = {}): slots.BookingInput => ({
  name: `Rivka Cohen ${n}`,
  phone: `05012345${String(n).padStart(2, "0")}`,
  email: null,
  needs: ["whatsapp"],
  needs_other: null,
  registered_by: null,
  ...over,
});
const student = async (n: number) => upsertStudent(db, { name: `Student ${n}`, email: `s${n}@emis.test`, phone: null });
const BASE = "https://example.test";

describe("booking a slot", () => {
  test("no overbooking: places run out, then 'full'; the same phone can't book twice", async () => {
    const id = (await slots.createSlot(db, slotInput()))!;
    expect((await slots.bookSlot(db, id, booking(1))).status).toBe("booked");
    expect((await slots.bookSlot(db, id, booking(1))).status).toBe("duplicate");
    expect((await slots.bookSlot(db, id, booking(2))).status).toBe("booked");
    expect((await slots.bookSlot(db, id, booking(3))).status).toBe("full");
    expect((await slots.getSlot(db, id))!.booked).toBe(2);
  });

  test("concurrent bookings never exceed the places", async () => {
    const id = (await slots.createSlot(db, slotInput({ resident_places: 3 })))!;
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => slots.bookSlot(db, id, booking(i + 1))));
    expect(results.filter((r) => r.status === "booked")).toHaveLength(3);
    expect(results.filter((r) => r.status === "full")).toHaveLength(9);
    expect((await slots.getSlot(db, id))!.booked).toBe(3);
  });

  test("closed slots, slots past their booking deadline and cancelled slots can't be booked", async () => {
    const closed = (await slots.createSlot(db, slotInput({ booking_open: false })))!;
    // starts tomorrow, booking closes 48 hours before: already past the deadline
    const late = (await slots.createSlot(db, slotInput({ slot_date: inDays(1), closes_hours_before: 48 })))!;
    const cancelled = (await slots.createSlot(db, slotInput({ slot_date: inDays(6) })))!;
    await slots.cancelSlot(db, cancelled);
    expect((await slots.bookSlot(db, closed, booking(1))).status).toBe("closed");
    expect((await slots.bookSlot(db, late, booking(1))).status).toBe("closed");
    expect((await slots.bookSlot(db, cancelled, booking(1))).status).toBe("not_found");
    expect((await slots.bookSlot(db, "00000000-0000-0000-0000-000000000000", booking(1))).status).toBe("not_found");
    // staff booking for a resident ignores the deadline, but not the capacity
    expect((await slots.bookSlot(db, late, booking(1), { staff: true })).status).toBe("booked");
  });

  test("a cancelled booking frees its place", async () => {
    const id = (await slots.createSlot(db, slotInput({ resident_places: 1 })))!;
    const first = await slots.bookSlot(db, id, booking(1));
    expect((await slots.bookSlot(db, id, booking(2))).status).toBe("full");
    if (first.status !== "booked") throw new Error("not booked");
    expect(await slots.cancelBooking(db, first.id)).toBe(true);
    expect((await slots.bookSlot(db, id, booking(2))).status).toBe("booked");
  });

  test("admin can move a booking only into a slot with room", async () => {
    const a = (await slots.createSlot(db, slotInput()))!;
    const b = (await slots.createSlot(db, slotInput({ slot_date: inDays(6), resident_places: 1 })))!;
    const one = await slots.bookSlot(db, a, booking(1));
    const two = await slots.bookSlot(db, a, booking(2));
    if (one.status !== "booked" || two.status !== "booked") throw new Error("not booked");
    expect(await slots.moveBooking(db, one.id, b)).toBe("moved");
    expect(await slots.moveBooking(db, two.id, b)).toBe("full");
    expect((await slots.getSlot(db, a))!.booked).toBe(1);
    expect((await slots.getSlot(db, b))!.booked).toBe(1);
  });

  test("booking sends a confirmation with the code (residents without email: the manual message queue)", async () => {
    const id = (await slots.createSlot(db, slotInput()))!;
    const res = await bookDigital(db, id, booking(1), BASE);
    if (res.status !== "booked") throw new Error("not booked");
    const [msg] = await listMessages(db);
    expect(msg.to_phone).toBe("0501234501");
    expect(msg.body).toContain(res.code);
    expect(msg.body).toContain("בחדר הקהילה");
  });
});

describe("student volunteers", () => {
  test("helpers are capped atomically; one place per student per slot", async () => {
    const id = (await slots.createSlot(db, slotInput({ helpers_needed: 2 })))!;
    const students = await Promise.all([1, 2, 3, 4].map(student));
    const results = await Promise.all(students.map((s) => slots.volunteer(db, id, s.id, { autoApprove: true })));
    expect(results.filter((r) => r === "confirmed")).toHaveLength(2);
    expect(results.filter((r) => r === "full")).toHaveLength(2);
    const ok = students[results.indexOf("confirmed")];
    expect(await slots.volunteer(db, id, ok.id, { autoApprove: true })).toBe("duplicate");
  });

  test("with leader approval on, a student waits as 'pending' until approved", async () => {
    await setSetting(db, "require_helper_approval", true);
    const id = (await slots.createSlot(db, slotInput()))!;
    const s = await student(1);
    expect(await volunteerForSlot(db, id, s, BASE)).toBe("pending");
    const [mine] = await slots.listStudentSlots(db, s.id);
    expect(mine.volunteer_status).toBe("pending");
    expect(await slots.approveVolunteer(db, mine.volunteer_id)).toBe(true);
    expect((await slots.listStudentSlots(db, s.id))[0].volunteer_status).toBe("confirmed");
  });

  test("students can cancel their own place only before the cutoff", async () => {
    const soon = (await slots.createSlot(db, slotInput({ slot_date: inDays(1) })))!;
    const later = (await slots.createSlot(db, slotInput({ slot_date: inDays(5) })))!;
    const s = await student(1);
    const other = await student(2);
    await slots.volunteer(db, soon, s.id, { autoApprove: true });
    await slots.volunteer(db, later, s.id, { autoApprove: true });
    const mine = await slots.listStudentSlots(db, s.id);
    const soonPlace = mine.find((m) => m.id === soon)!.volunteer_id;
    const laterPlace = mine.find((m) => m.id === later)!.volunteer_id;
    // within 48 hours of the slot: too late (cutoff 48h)
    expect(await slots.cancelOwnVolunteering(db, soonPlace, s.id, 48)).toBe(false);
    // someone else's place: never
    expect(await slots.cancelOwnVolunteering(db, laterPlace, other.id, 24)).toBe(false);
    expect(await slots.cancelOwnVolunteering(db, laterPlace, s.id, 24)).toBe(true);
  });
});

describe("what a volunteer sees about residents", () => {
  async function setup(daysAhead: number) {
    const id = (await slots.createSlot(db, slotInput({ slot_date: inDays(daysAhead) })))!;
    await slots.bookSlot(db, id, booking(1), { staff: true });
    const s = await student(1);
    await slots.volunteer(db, id, s.id, { autoApprove: true });
    return { id, s };
  }

  test("first name and need only; never the surname", async () => {
    const { s } = await setup(5);
    const [r] = await slots.listResidentsForVolunteer(db, s.id);
    expect(r).toMatchObject({ first_name: "Rivka", needs: ["whatsapp"], phone: null });
    expect(JSON.stringify(r)).not.toContain("Cohen");
  });

  test("the phone appears only after the code of conduct AND within 48 hours of the slot", async () => {
    const far = await setup(5);
    await acceptConduct(db, far.s.id);
    expect((await slots.listResidentsForVolunteer(db, far.s.id))[0].phone).toBeNull();

    db = await testDb();
    const near = await setup(1);
    expect((await slots.listResidentsForVolunteer(db, near.s.id))[0].phone).toBeNull();
    await acceptConduct(db, near.s.id);
    expect((await slots.listResidentsForVolunteer(db, near.s.id))[0].phone).toBe("0501234501");
  });

  test("never for other slots, and not while the student's place is still pending", async () => {
    const { s } = await setup(1);
    await acceptConduct(db, s.id);
    // another slot with a resident, where this student is not a helper
    const other = (await slots.createSlot(db, slotInput({ slot_date: inDays(1), start_time: "18:00", end_time: "19:00" })))!;
    await slots.bookSlot(db, other, booking(2), { staff: true });
    const seen = await slots.listResidentsForVolunteer(db, s.id);
    expect(seen).toHaveLength(1);
    expect(seen.map((r) => r.phone)).not.toContain("0501234502");

    const pendingStudent = await student(2);
    await acceptConduct(db, pendingStudent.id);
    await slots.volunteer(db, other, pendingStudent.id, { autoApprove: false });
    expect((await slots.listResidentsForVolunteer(db, pendingStudent.id))[0].phone).toBeNull();
  });
});

describe("weekly series, blocked dates and changes", () => {
  test("weekly dates run every 7 days, skip blocked dates and are capped", () => {
    expect(slots.weeklyDates("2030-01-01", "2030-01-29")).toEqual(["2030-01-01", "2030-01-08", "2030-01-15", "2030-01-22", "2030-01-29"]);
    expect(slots.weeklyDates("2030-01-01", "2030-01-29", new Set(["2030-01-15"]))).toEqual([
      "2030-01-01",
      "2030-01-08",
      "2030-01-22",
      "2030-01-29",
    ]);
    expect(slots.weeklyDates("2030-01-01", "2032-01-01")).toHaveLength(slots.MAX_SERIES_OCCURRENCES);
  });

  test("a series creates one slot per week; one occurrence can be edited or cancelled on its own", async () => {
    const first = inDays(7);
    const until = new Date(Date.parse(`${first}T00:00:00Z`) + 21 * 86_400_000).toISOString().slice(0, 10);
    const blocked = new Date(Date.parse(`${first}T00:00:00Z`) + 14 * 86_400_000).toISOString().slice(0, 10);
    await slots.addBlockedDate(db, blocked, "חג");
    const { created, seriesId } = await slots.createSeries(db, slotInput({ slot_date: first }), until, "admin@test");
    expect(created).toBe(3); // 4 weeks, one blocked
    const all = (await slots.listUpcomingSlots(db)).filter((s) => s.series_id === seriesId);
    expect(all.map((s) => s.slot_date)).not.toContain(blocked);

    const [a, b] = all;
    await updateSlotAndNotify(db, a.id, { ...slotInput({ slot_date: a.slot_date }), start_time: "17:00", end_time: "18:00" });
    expect((await slots.getSlot(db, a.id))!.start_time).toBe("17:00");
    expect((await slots.getSlot(db, b.id))!.start_time).toBe("16:00");
    await cancelSlotAndNotify(db, b.id);
    expect((await slots.getSlot(db, b.id))!.status).toBe("cancelled");
    expect((await slots.getSlot(db, a.id))!.status).toBe("scheduled");
  });

  test("changing or cancelling a slot tells the people in it; blocking a date cancels its slots", async () => {
    const id = (await slots.createSlot(db, slotInput({ slot_date: inDays(9) })))!;
    await bookDigital(db, id, booking(1), BASE);
    const before = (await listMessages(db)).length;
    expect(await updateSlotAndNotify(db, id, slotInput({ slot_date: inDays(9), place_he: "בספרייה" }))).toBe(1);
    expect((await listMessages(db))[0].body).toContain("בספרייה");
    // no change of time or place: nobody is bothered
    expect(await updateSlotAndNotify(db, id, slotInput({ slot_date: inDays(9), place_he: "בספרייה", resident_places: 3 }))).toBe(0);
    expect(await blockDateAndCancel(db, inDays(9), "חג")).toEqual({ cancelled: 1, notified: 1 });
    expect((await slots.getSlot(db, id))!.status).toBe("cancelled");
    expect((await listMessages(db)).length).toBe(before + 2);
  });
});

describe("without a school-email rule in production, helpers wait for a leader", () => {
  test("volunteering is 'pending', not confirmed", async () => {
    const { vi } = await import("vitest");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STUDENT_EMAIL_DOMAINS", "");
    try {
      const id = (await slots.createSlot(db, slotInput()))!;
      const s = await student(1);
      expect(await volunteerForSlot(db, id, s, BASE)).toBe("pending");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
