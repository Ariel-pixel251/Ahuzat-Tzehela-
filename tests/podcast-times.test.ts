import { beforeEach, describe, expect, test } from "vitest";
import { listMessages } from "@/lib/db/misc";
import * as podcast from "@/lib/db/podcast";
import type { Db } from "@/lib/db/types";
import { adminPairPodcast, cancelPodcastTimeAndNotify, joinPodcast, leavePodcastByToken } from "@/lib/domain";
import { testDb } from "./helpers/db";
import { captureEmails } from "./helpers/emails";

const emails = captureEmails();

// Podcast times work like digital support slots: the team sets them (places for residents and for
// students), people choose one, a time for one of each pairs them automatically, and a pair of
// people who chose the same time meets then.

let db: Db;
beforeEach(async () => {
  db = await testDb();
});

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const TIME = { start_time: "16:00", end_time: "17:30", place_he: "בספרייה", place_en: "Library", resident_places: 1, student_places: 1 };

async function newTime(days = 3, extra: Partial<podcast.PodcastTimeInput> = {}) {
  await podcast.createPodcastTimes(db, { time_date: inDays(days), ...TIME, ...extra }, null);
  const all = await podcast.listAllTimes(db);
  return all.find((t) => t.time_date === inDays(days))!;
}

const person = (name: string, portal: "student" | "resident", phone: string, time_id: string | null): podcast.ParticipantInput => ({
  name,
  email: null,
  phone,
  portal,
  topics: ["history"],
  language: "he",
  availability: null,
  registered_by: null,
  time_id,
});

describe("podcast times", () => {
  test("weekly times: one every 7 days until the last date", async () => {
    expect(await podcast.createPodcastTimes(db, { time_date: inDays(1), ...TIME }, inDays(22))).toBe(4);
    const dates = (await podcast.listUpcomingTimes(db)).map((t) => t.time_date);
    expect(dates).toEqual([inDays(1), inDays(8), inDays(15), inDays(22)]);
  });

  test("a time is full for residents once its resident places are taken; students count separately", async () => {
    const t = await newTime();
    expect((await podcast.joinPodcastAt(db, person("Rivka", "resident", "0501111111", t.id))).status).toBe("joined");
    expect((await podcast.joinPodcastAt(db, person("Sara", "resident", "0502222222", t.id))).status).toBe("full");
    expect((await podcast.joinPodcastAt(db, person("Dana", "student", "0503333333", t.id))).status).toBe("joined");
    const [row] = await podcast.listUpcomingTimes(db);
    expect(row).toMatchObject({ residents: 1, students: 1, resident_places: 1, student_places: 1 });
    expect(podcast.placesLeft(row, "resident")).toBe(0);
    // the team may still add someone
    expect((await podcast.joinPodcastAt(db, person("Sara", "resident", "0502222222", t.id), { staff: true })).status).toBe("joined");
  });

  test("parallel sign-ups can't overfill a time", async () => {
    const t = await newTime(3, { resident_places: 2, student_places: 2 });
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => podcast.joinPodcastAt(db, person(`R${i}`, "resident", `050400000${i}`, t.id))),
    );
    expect(results.filter((r) => r.status === "joined")).toHaveLength(2);
  });

  test("closed, past, cancelled and unknown times can't be chosen", async () => {
    const t = await newTime();
    await podcast.setPodcastTimeOpen(db, t.id, false);
    expect((await podcast.joinPodcastAt(db, person("A", "resident", "0501111111", t.id))).status).toBe("closed");
    const past = await newTime(-2);
    expect((await podcast.joinPodcastAt(db, person("B", "resident", "0502222222", past.id))).status).toBe("closed");
    expect((await podcast.joinPodcastAt(db, person("C", "resident", "0503333333", "00000000-0000-4000-8000-000000000000"))).status).toBe(
      "not_found",
    );
    const cancelled = await newTime(5);
    await podcast.cancelPodcastTime(db, cancelled.id);
    expect((await podcast.joinPodcastAt(db, person("D", "resident", "0504444444", cancelled.id))).status).toBe("not_found");
  });

  test("the portals list only open times with places left for them", async () => {
    const full = await newTime(3);
    const closed = await newTime(4);
    const open = await newTime(5);
    await podcast.joinPodcastAt(db, person("Rivka", "resident", "0501111111", full.id));
    await podcast.setPodcastTimeOpen(db, closed.id, false);
    expect((await podcast.listOpenTimes(db, "resident")).map((t) => t.id)).toEqual([open.id]);
    expect((await podcast.listOpenTimes(db, "student")).map((t) => t.id)).toEqual([full.id, open.id]);
  });

  test("cancelling a time tells everyone who chose it, and they can sign up again", async () => {
    const t = await newTime(3, { resident_places: 2, student_places: 2 });
    await joinPodcast(db, person("Rivka", "resident", "0501111111", t.id), "https://x.test");
    await joinPodcast(db, { ...person("Dana", "student", "", t.id), phone: null, email: "dana@emis.test" }, "https://x.test");
    expect(await cancelPodcastTimeAndNotify(db, t.id)).toBe(2);
    expect(await cancelPodcastTimeAndNotify(db, t.id)).toBeNull();
    expect((await listMessages(db)).map((m) => m.body).join("\n")).toContain("בוטל");
    expect(emails.join("\n")).toContain("has been cancelled");
    const other = await newTime(6);
    expect((await podcast.joinPodcastAt(db, person("Rivka", "resident", "0501111111", other.id))).status).toBe("joined");
  });

  test("leaving with the cancel token frees the place; the same phone can sign up again", async () => {
    const t = await newTime();
    const res = await podcast.joinPodcastAt(db, person("Rivka", "resident", "0501111111", t.id));
    if (res.status !== "joined") throw new Error(res.status);
    expect(await leavePodcastByToken(db, "x".repeat(43))).toBe(false);
    expect(await leavePodcastByToken(db, res.token)).toBe(true);
    expect(await leavePodcastByToken(db, res.token)).toBe(false);
    expect((await podcast.joinPodcastAt(db, person("Rivka", "resident", "0501111111", t.id))).status).toBe("joined");
  });

  test("the sign-up message names the chosen time", async () => {
    const t = await newTime();
    await joinPodcast(db, person("Rivka", "resident", "0501111111", t.id), "https://x.test");
    const [msg] = await listMessages(db);
    expect(msg.body).toContain("בספרייה");
    expect(msg.body).toContain("16:00");
  });
});

describe("pairs and times", () => {
  test("a time for one resident and one student pairs them automatically and tells both (no phone numbers)", async () => {
    const t = await newTime();
    await joinPodcast(db, person("Rivka Cohen", "resident", "0501111111", t.id), "https://x.test");
    expect(await podcast.listPairs(db)).toHaveLength(0);
    await joinPodcast(db, { ...person("Dana Levi", "student", "", t.id), phone: null, email: "dana@emis.test", language: "en" }, "https://x.test");
    const [pair] = await podcast.listPairs(db);
    expect(pair.created_by).toBe("participants");
    expect(pair).toMatchObject({ meeting_date: t.time_date, meeting_time: "16:00" });
    const toStudent = emails.find((m) => m.includes("To: dana@emis.test") && m.includes("paired"))!;
    expect(toStudent).toContain("Rivka");
    expect(toStudent).not.toContain("Cohen");
    expect(toStudent).toContain("Hebrew");
    expect(toStudent).not.toMatch(/050-?111-?1111/);
    // the resident is told too (by message, no email)
    expect((await listMessages(db)).map((m) => m.body).join("\n")).toContain("Dana");
  });

  test("a time with several places waits for the team to pair people", async () => {
    const t = await newTime(3, { resident_places: 2, student_places: 2 });
    await joinPodcast(db, person("Rivka", "resident", "0501111111", t.id), "https://x.test");
    await joinPodcast(db, { ...person("Dana", "student", "", t.id), phone: null, email: "dana@emis.test" }, "https://x.test");
    expect(await podcast.listPairs(db)).toHaveLength(0);
  });

  test("two people who chose the same time meet then; the message says when", async () => {
    const t = await newTime();
    const a = await podcast.joinPodcastAt(db, person("Rivka", "resident", "0501111111", t.id));
    const b = await podcast.joinPodcastAt(db, person("Dana", "student", "0502222222", t.id));
    if (a.status !== "joined" || b.status !== "joined") throw new Error();
    const pairId = await adminPairPodcast(db, a.id, b.id, { notify: true });
    const [pair] = await podcast.listPairs(db);
    expect(pair).toMatchObject({ pair_id: pairId, meeting_date: t.time_date, meeting_time: "16:00", meeting_place: "בספרייה" });
    const bodies = (await listMessages(db)).map((m) => m.body).join("\n");
    expect(bodies).toContain("נפגשים");
  });

  test("different times (or none): no meeting is set; a meeting typed in by the team wins", async () => {
    const t1 = await newTime(3);
    const t2 = await newTime(4);
    const a = await podcast.joinPodcastAt(db, person("A", "resident", "0501111111", t1.id));
    const b = await podcast.joinPodcastAt(db, person("B", "student", "0502222222", t2.id));
    const c = await podcast.joinPodcastAt(db, person("C", "resident", "0503333333", t1.id), { staff: true });
    const d = await podcast.joinPodcastAt(db, person("D", "student", "0504444444", t1.id));
    if (a.status !== "joined" || b.status !== "joined" || c.status !== "joined" || d.status !== "joined") throw new Error();
    await adminPairPodcast(db, a.id, b.id, { notify: false });
    await adminPairPodcast(db, c.id, d.id, { notify: false, meeting: { date: inDays(10), time: "11:00", place: "בלובי" } });
    const pairs = await podcast.listPairs(db);
    const ab = pairs.find((p) => p.members.some((m) => m.id === a.id))!;
    const cd = pairs.find((p) => p.members.some((m) => m.id === c.id))!;
    expect(ab.meeting_date).toBeNull();
    expect(cd).toMatchObject({ meeting_date: inDays(10), meeting_time: "11:00", meeting_place: "בלובי" });
  });
});
