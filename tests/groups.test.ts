import { beforeEach, describe, expect, test } from "vitest";
import { listMessages } from "@/lib/db/misc";
import * as podcast from "@/lib/db/podcast";
import * as slots from "@/lib/db/slots";
import { addStudentByAdmin, getStudent } from "@/lib/db/students";
import type { Db } from "@/lib/db/types";
import { adminAddVolunteer, adminPairPodcast } from "@/lib/domain";
import { testDb } from "./helpers/db";

// Admins can make groups with people who never signed up, and optionally tell them who and when.

let db: Db;
beforeEach(async () => {
  db = await testDb();
});

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

describe("podcast pairs made by an admin", () => {
  const addByStaff = (name: string, portal: "student" | "resident", phone: string | null) =>
    podcast.joinPodcast(db, { name, email: null, phone, portal, topics: [], language: "he", availability: null, registered_by: "staff: admin@test" });

  test("people added by staff need no email or phone; the pair gets its meeting time", async () => {
    const a = (await addByStaff("Noa Student", "student", null))!;
    const b = (await addByStaff("Moshe Resident", "resident", "0521112233"))!;
    const pair = await adminPairPodcast(db, a.id, b.id, { meeting: { date: "2030-11-03", time: "16:00", place: "בספרייה" }, notify: true });
    expect(pair).toBeTruthy();
    const [row] = await podcast.listPairs(db);
    expect(row).toMatchObject({ meeting_date: "2030-11-03", meeting_time: "16:00", meeting_place: "בספרייה" });
    // the resident (no email) gets a text in the manual queue: partner and when, in Hebrew words
    const [msg] = await listMessages(db);
    expect(msg.to_phone).toBe("0521112233");
    expect(msg.body).toContain("Noa");
    expect(msg.body).toContain("בספרייה");
    expect(msg.body).toContain("16:00");
  });

  test("with the message unticked, nobody is contacted", async () => {
    const a = (await addByStaff("Noa", "student", "0501111111"))!;
    const b = (await addByStaff("Moshe", "resident", "0502222222"))!;
    await adminPairPodcast(db, a.id, b.id, { notify: false });
    expect(await listMessages(db)).toHaveLength(0);
  });

  test("people who sign up themselves still need an email or phone", async () => {
    await expect(
      podcast.joinPodcast(db, { name: "X", email: null, phone: null, portal: "student", topics: [], language: "en", availability: null, registered_by: null }),
    ).rejects.toThrow();
  });
});

describe("helpers added by an admin", () => {
  test("a student without an email can be put into a slot; with an email they get who and when", async () => {
    const slot = (await slots.createSlot(db, {
      slot_date: inDays(4),
      start_time: "16:00",
      end_time: "17:30",
      place_he: "בחדר הקהילה",
      place_en: "Community room",
      resident_places: 3,
      helpers_needed: 2,
      note_en: null,
      note_he: null,
      booking_open: true,
      closes_hours_before: null,
    }))!;
    await slots.bookSlot(db, slot, { name: "Rivka Cohen", phone: "0501234567", email: null, needs: ["phone"], needs_other: null, registered_by: null });

    const noEmail = await addStudentByAdmin(db, { name: "Yoni Levi", email: null, phone: "0549998877", added_by: "admin@test" });
    expect((await getStudent(db, noEmail))?.email).toBeNull();
    expect(await adminAddVolunteer(db, slot, noEmail, { notify: true, baseUrl: "https://x.test" })).toBe("confirmed");
    // no email, so the message goes to the manual queue (a student with only a phone)
    const [queued] = await listMessages(db);
    expect(queued.body).toContain("Community room");
    expect(queued.body).toContain("Rivka");
    expect(queued.body).not.toContain("Cohen");

    // with an email: an existing student with that email is reused, not duplicated
    const first = await addStudentByAdmin(db, { name: "Dana", email: "dana@emis.test", phone: null, added_by: "admin@test" });
    const again = await addStudentByAdmin(db, { name: "Someone else", email: "DANA@emis.test", phone: null, added_by: "admin@test" });
    expect(again).toBe(first);
    expect((await getStudent(db, first))?.name).toBe("Dana");
  });
});
