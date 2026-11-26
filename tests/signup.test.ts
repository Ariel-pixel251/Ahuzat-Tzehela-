import { beforeEach, describe, expect, test, vi } from "vitest";
import * as podcast from "@/lib/db/podcast";
import * as slots from "@/lib/db/slots";
import type { Db } from "@/lib/db/types";
import { testDb } from "./helpers/db";
import { captureEmails } from "./helpers/emails";

// The simple sign-up through the real server actions: residents' two screens (a duplicate shows the
// same success), students' card forms, and the cancel tokens behind both. Students never receive
// residents' phone numbers, and cancel tokens can't be guessed.

let db: Db;
let address = "10.1.0.1";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": address }),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {}, getAll: () => [] }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/db/client", () => ({ getDb: async () => db, databaseMode: () => "local" }));

const residents = await import("@/app/actions/residents");
const students = await import("@/app/actions/students");
const emails = captureEmails();

let n = 0;
beforeEach(async () => {
  db = await testDb();
  address = `10.1.${Math.floor(++n / 250)}.${n % 250}`;
});

const fd = (fields: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const RESIDENT_PHONE = "0527654321";

async function newSlot(resident_places = 2) {
  return (await slots.createSlot(db, {
    slot_date: inDays(1),
    start_time: "16:00",
    end_time: "17:00",
    place_he: "בספרייה",
    place_en: "Library",
    resident_places,
    helpers_needed: 2,
    note_en: null,
    note_he: null,
    booking_open: true,
    closes_hours_before: null,
  }))!;
}

async function newTime(places = 1) {
  await podcast.createPodcastTimes(
    db,
    { time_date: inDays(4), start_time: "10:00", end_time: "11:00", place_he: "בלובי", place_en: "Lobby", resident_places: places, student_places: places },
    null,
  );
  return (await podcast.listUpcomingTimes(db))[0].id;
}

describe("residents: two screens", () => {
  test("help: success has when and where, the code and a cancel token; the same phone again is the same success", async () => {
    const slot = await newSlot();
    const first = await residents.bookHelpSlot(null, fd({ slot, name: "רבקה כהן", phone: RESIDENT_PHONE, needs: [] }));
    expect(first).toMatchObject({ ok: true, code: expect.stringMatching(/^\d{4}$/), data: { place: "בספרייה", token: expect.any(String) } });
    expect((first!.data as { when: string }).when).toMatch(/בשעה 16:00/);
    const again = await residents.bookHelpSlot(null, fd({ slot, name: "רבקה", phone: "052-765-4321", needs: [] }));
    // no code on a repeat: nobody learns someone else's code by typing their phone number
    expect(again).toMatchObject({ ok: true, data: { place: "בספרייה" } });
    expect(again?.code).toBeUndefined();
    // the cancel button on the success screen
    const token = (first!.data as { token: string }).token;
    expect(await residents.cancelHelpByToken(null, fd({ token }))).toMatchObject({ ok: true });
    expect((await slots.getSlot(db, slot))!.booked).toBe(0);
  });

  test("residents give no email (the form rejects one)", async () => {
    const slot = await newSlot();
    const res = await residents.bookHelpSlot(null, fd({ slot, name: "רבקה", phone: RESIDENT_PHONE, needs: [], email: "r@example.com" }));
    expect(res?.ok).toBe(false);
  });

  test("podcast: the same time again is the same success; another time says so", async () => {
    const time = await newTime(2);
    await podcast.createPodcastTimes(db, { time_date: inDays(6), start_time: "10:00", end_time: "11:00", place_he: "בלובי", place_en: null, resident_places: 2, student_places: 2 }, null);
    const other = (await podcast.listUpcomingTimes(db)).find((t) => t.id !== time)!.id;
    const first = await residents.joinPodcastAsResident(null, fd({ time, language: "he", name: "רבקה", phone: RESIDENT_PHONE }));
    expect(first).toMatchObject({ ok: true, code: expect.stringMatching(/^\d{4}$/) });
    expect(await residents.joinPodcastAsResident(null, fd({ time, language: "he", name: "רבקה", phone: RESIDENT_PHONE }))).toMatchObject({ ok: true });
    expect(await residents.joinPodcastAsResident(null, fd({ time: other, language: "he", name: "רבקה", phone: RESIDENT_PHONE }))).toMatchObject({ ok: false });
    // residents choose no topic: stored as an empty list
    const [p] = await podcast.listParticipants(db);
    expect(p.topics).toEqual([]);
  });

  test("a full slot sends the person back to choose another", async () => {
    const slot = await newSlot(1);
    await residents.bookHelpSlot(null, fd({ slot, name: "רבקה", phone: RESIDENT_PHONE, needs: [] }));
    const res = await residents.bookHelpSlot(null, fd({ slot, name: "שרה", phone: "0521112222", needs: [] }));
    expect(res?.ok).toBe(false);
    expect(res?.errors?.slot).toBeTruthy();
  });

  test("the code cancels from the status page", async () => {
    const slot = await newSlot();
    const res = await residents.bookHelpSlot(null, fd({ slot, name: "רבקה", phone: RESIDENT_PHONE, needs: [] }));
    const wrong = res!.code === "1111" ? "2222" : "1111";
    expect((await residents.cancelWithCode(null, fd({ phone: RESIDENT_PHONE, code: wrong })))?.ok).toBe(false);
    expect((await residents.cancelWithCode(null, fd({ phone: RESIDENT_PHONE, code: res!.code! })))?.ok).toBe(true);
    expect((await slots.getSlot(db, slot))!.booked).toBe(0);
  });
});

describe("students: sign up from the card", () => {
  test("digital support: under 18 needs a parent or guardian; the details are saved for the admin list", async () => {
    const slot = await newSlot();
    const base = { slot, name: "Dana Levi", email: "dana@emis.test", consent: "on" };
    const missing = await students.signUpForSlot(null, fd({ ...base, under_18: "on", guardian_name: "", guardian_phone: "" }));
    expect(missing?.ok).toBe(false);
    expect(missing?.errors?.guardian_name).toBeTruthy();
    expect((await students.signUpForSlot(null, fd({ ...base, consent: "" })))?.ok).toBe(false);
    const ok = await students.signUpForSlot(null, fd({ ...base, under_18: "on", guardian_name: "Ruth Levi", guardian_phone: "0541112233" }));
    expect(ok?.ok).toBe(true);
    const [v] = await slots.listVolunteersForAdmin(db);
    expect(v).toMatchObject({ student_name: "Dana Levi", student_email: "dana@emis.test", age_group: "under-18", guardian_name: "Ruth Levi", guardian_phone: "0541112233" });
    expect(emails.join("\n")).toMatch(/digital-support\/cancel\?token=/);
    expect((await students.signUpForSlot(null, fd({ ...base, under_18: "", guardian_name: "", guardian_phone: "" })))?.ok).toBe(false);
  });

  test("only school emails when the rule is set", async () => {
    vi.stubEnv("STUDENT_EMAIL_DOMAINS", "emis.test");
    try {
      const slot = await newSlot();
      const res = await students.signUpForSlot(null, fd({ slot, name: "Dana", email: "dana@gmail.com", consent: "on" }));
      expect(res?.errors?.email).toMatch(/school email/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test("podcast: one topic stored as a one-item list; the cancel link leaves", async () => {
    const time = await newTime(2);
    const res = await students.signUpForPodcastTime(null, fd({ time, name: "Dana", email: "dana@emis.test", topic: "music", language: "en", consent: "on" }));
    expect(res?.ok).toBe(true);
    const [p] = await podcast.listParticipants(db);
    expect(p).toMatchObject({ topics: ["music"], language: "en", time_id: time, portal: "student" });
    const token = emails.join("\n").match(/podcast\/cancel\?token=([A-Za-z0-9_-]+)/)![1];
    expect(await students.leavePodcast(null, fd({ token }))).toMatchObject({ ok: true });
    expect((await podcast.getParticipant(db, p.id))?.active).toBe(false);
  });
});

describe("students never get residents' phone numbers", () => {
  test("not in any answer or email, through sign-up, pairing and the reminder", async () => {
    const slot = await newSlot();
    const time = await newTime(1);
    const answers = [
      await residents.bookHelpSlot(null, fd({ slot, name: "רבקה כהן", phone: RESIDENT_PHONE, needs: ["whatsapp"] })),
      await residents.joinPodcastAsResident(null, fd({ time, language: "he", name: "רבקה כהן", phone: RESIDENT_PHONE })),
      await students.signUpForSlot(null, fd({ slot, name: "Dana", email: "dana@emis.test", consent: "on" })),
      await students.signUpForPodcastTime(null, fd({ time, name: "Dana", email: "dana@emis.test", topic: "music", language: "en", consent: "on" })),
    ];
    // the podcast time pairs them automatically; the cron sends tomorrow's reminders
    const { sendSlotReminders } = await import("@/lib/domain");
    await sendSlotReminders(db);
    expect(await podcast.listPairs(db)).toHaveLength(1);
    const toStudent = emails.filter((m) => m.includes("To: dana@emis.test"));
    expect(toStudent.length).toBeGreaterThanOrEqual(4);
    const studentSide = JSON.stringify(answers.slice(2)) + toStudent.join("\n");
    for (const shape of [RESIDENT_PHONE, "052-765-4321", "+972527654321", "527654321", "כהן"]) expect(studentSide).not.toContain(shape);
    expect(studentSide).toContain("רבקה");
  });
});

describe("cancel tokens can't be guessed", () => {
  test("tokens are 256-bit random and only their hash is stored", async () => {
    const slot = await newSlot();
    const res = await residents.bookHelpSlot(null, fd({ slot, name: "רבקה", phone: RESIDENT_PHONE, needs: [] }));
    const token = (res!.data as { token: string }).token;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = await db.query<{ h: string }>(`select manage_token_hash as h from digital_bookings`);
    expect(stored[0].h).toMatch(/^[0-9a-f]{64}$/);
    expect(stored[0].h).not.toContain(token);
  });

  test("guessing from one address is rate-limited, even with the right token afterwards", async () => {
    const slot = await newSlot();
    const res = await residents.bookHelpSlot(null, fd({ slot, name: "רבקה", phone: RESIDENT_PHONE, needs: [] }));
    const token = (res!.data as { token: string }).token;
    for (let i = 0; i < 20; i++) await residents.cancelHelpByToken(null, fd({ token: `guess${String(i).padStart(38, "0")}` }));
    expect((await residents.cancelHelpByToken(null, fd({ token })))?.ok).toBe(false);
    for (let i = 0; i < 20; i++) await students.cancelSlotPlaceByToken(null, fd({ token: `guess${String(i).padStart(38, "0")}` }));
    expect((await students.cancelSlotPlaceByToken(null, fd({ token })))?.message).toMatch(/requests|try again/i);
  });
});
