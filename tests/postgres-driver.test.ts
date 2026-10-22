import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { afterAll, beforeAll, expect, test } from "vitest";
import * as events from "@/lib/db/events";
import { audit, codeAttempt, deletePersonData, getSetting, hitRateLimit, listAudit, lookupStatus, purgeOldData, setSetting } from "@/lib/db/misc";
import * as podcast from "@/lib/db/podcast";
import * as slots from "@/lib/db/slots";
import { acceptConduct, addStudentByAdmin, saveProfile, upsertStudent } from "@/lib/db/students";
import { connect, createServer, type Server } from "node:net";
import { DbTimeoutError, postgresDb } from "@/lib/db/postgres";
import type { Db } from "@/lib/db/types";
import { applyMigrations } from "@/lib/db/migrate";

// The production driver (node-postgres, as used with Supabase) over the real Postgres wire protocol.
// The other database tests call PGlite directly, which binds parameters differently; this file
// catches driver differences such as JSON parameters being encoded twice. The queries go through a
// stand-in for Supabase's transaction pooler, which doesn't pass on "Flush" messages: a driver that
// waits for an answer to one (postgres.js did) hangs like it did on the live site. PGlite answers
// without waiting for a Flush, so that hang only shows against a real Postgres: CI runs one
// (TEST_POSTGRES_URL) for the last test.

const PORT = 55432;
const POOLER_PORT = 55434;
let server: PGLiteSocketServer;
let pooler: Server;
let pg: PGlite;
let db: Db;
let end: () => Promise<void>;

beforeAll(async () => {
  pg = new PGlite();
  await applyMigrations(pg);
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1" });
  await server.start();
  pooler = await poolerStandIn(POOLER_PORT, PORT);
  ({ db, end } = postgresDb(`postgres://postgres:postgres@127.0.0.1:${POOLER_PORT}/postgres`, { max: 1, ssl: false }));
});

/** Forwards the Postgres protocol both ways, but drops the client's Flush ("H") messages. */
async function poolerStandIn(port: number, target: number, host = "127.0.0.1") {
  const proxy = createServer((client) => {
    const upstream = connect(target, host);
    let buffer = Buffer.alloc(0);
    let started = false;
    client.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      for (;;) {
        // the startup message has no type byte; every later message has one
        const head = started ? 1 : 0;
        if (buffer.length < head + 4) break;
        const size = head + buffer.readInt32BE(head);
        if (buffer.length < size) break;
        const message = buffer.subarray(0, size);
        buffer = buffer.subarray(size);
        if (!started) started = true;
        else if (message[0] === 0x48) continue; // "H": Flush
        upstream.write(message);
      }
    });
    upstream.pipe(client);
    client.on("error", () => upstream.destroy());
    upstream.on("error", () => client.destroy());
    client.on("close", () => upstream.destroy());
  });
  await new Promise<void>((resolve) => proxy.listen(port, "127.0.0.1", resolve));
  return proxy;
}

afterAll(async () => {
  await end?.();
  pooler?.close();
  await server?.stop();
  await pg?.close();
});

test("slots: create, book (a JSON parameter with a list), volunteer and the contact rule", async () => {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const id = (await slots.createSlot(db, {
    slot_date: tomorrow,
    start_time: "16:00",
    end_time: "17:30",
    place_he: "בחדר הקהילה",
    place_en: null,
    resident_places: 2,
    helpers_needed: 1,
    note_en: null,
    note_he: null,
    booking_open: true,
    closes_hours_before: null,
  }))!;
  const res = await slots.bookSlot(db, id, { name: "רבקה כהן", phone: "0501234567", email: null, needs: ["whatsapp", "banking"], needs_other: null, registered_by: null });
  expect(res.status).toBe("booked");
  const slot = (await slots.getSlot(db, id))!;
  expect(slot).toMatchObject({ slot_date: tomorrow, booked: 1, booking_open: true, closes_hours_before: null });
  expect(slot.starts_at).toBeInstanceOf(Date);

  const s = await upsertStudent(db, { name: "Dana", email: "dana@emis.test", phone: null });
  await saveProfile(db, s.id, { phone: null, age_group: "under-18", guardian_name: "Parent", guardian_phone: "0509999999" });
  expect(await slots.volunteer(db, id, s.id, { autoApprove: true })).toBe("confirmed");
  await acceptConduct(db, s.id);
  const [r] = await slots.listResidentsForVolunteer(db, s.id);
  expect(r).toMatchObject({ first_name: "רבקה", needs: ["whatsapp", "banking"], phone: "0501234567" });
  expect(await slots.cancelOwnVolunteering(db, (await slots.listStudentSlots(db, s.id))[0].volunteer_id, s.id, 48)).toBe(false);

  const extra = await addStudentByAdmin(db, { name: "No Email", email: null, phone: null, added_by: "admin" });
  expect(extra).toBeTruthy();
  const series = await slots.createSeries(db, { ...slot, slot_date: tomorrow, place_en: null }, tomorrow, "admin");
  // a weekly series through the driver (date and boolean parameters)
  expect(series.created).toBe(1);
});

test("audit log, lockout, retention and delete-a-person through the driver", async () => {
  await audit(db, "admin@test", "export", "digital", { rows: 3 });
  expect((await listAudit(db))[0]).toMatchObject({ actor: "admin@test", details: { rows: 3 } });
  for (let i = 0; i < 5; i++) expect(await codeAttempt(db, "0500000009")).toBe(true);
  expect(await codeAttempt(db, "0500000009")).toBe(false);
  expect(typeof (await purgeOldData(db)).event_registrations).toBe("number");
  expect((await deletePersonData(db, "0501234567", null)).digital_bookings).toBe(1);
});

test("event registration (a JSON object parameter) and the waiting list", async () => {
  const base: events.RegistrationInput = {
    event_key: "uid-drv@google.com",
    event_title_en: "Party",
    event_title_he: "מסיבה",
    event_date: "2030-12-10",
    event_time: "17:00",
    kind: "language-night",
    portal: "resident",
    name: "A",
    phone: "0500000001",
    email: null,
    attendees: 1,
    notes: null,
    languages: ["he", "ru"],
    other_language: null,
    preferred_language: null,
    registered_by: null,
  };
  const first = await events.registerForEvent(db, base, 1);
  expect(first.status).toBe("confirmed");
  expect((await events.registerForEvent(db, { ...base, name: "B", phone: "0500000002" }, 1)).status).toBe("waitlist");
  const [row] = await events.listRegistrationsForEvent(db, base.event_key);
  expect(row).toMatchObject({ languages: ["he", "ru"], event_date: "2030-12-10" });
  expect((await events.confirmedCounts(db, [base.event_key])).get(base.event_key)).toBe(1);
  if (first.status !== "confirmed") throw new Error();
  const promoted = await events.cancelRegistration(db, first.id, 1);
  expect(promoted.map((p) => p.name)).toEqual(["B"]);
  await events.registerForEvent(db, { ...base, name: "C", phone: "0500000003" }, 1);
  expect((await events.promoteWaitlist(db, base.event_key, 2)).map((p) => p.name)).toEqual(["C"]);
});

test("settings keep their type (false stays false)", async () => {
  await setSetting(db, "require_helper_approval", false);
  expect(await getSetting(db, "require_helper_approval", true)).toBe(false);
  await setSetting(db, "require_helper_approval", true);
  expect(await getSetting(db, "require_helper_approval", false)).toBe(true);
});

test("podcast topics, pairs and the status lookup", async () => {
  const join = (name: string, phone: string) =>
    podcast.joinPodcast(db, { name, email: null, phone, portal: "resident", topics: ["music", "history"], language: "he", availability: null, registered_by: null });
  const a = (await join("A", "0521111111"))!;
  const b = (await join("B", "0522222222"))!;
  expect((await podcast.getParticipant(db, a.id))?.topics).toEqual(["music", "history"]);
  const pairId = (await podcast.makePair(db, a.id, b.id))!;
  expect(pairId).toBeTruthy();
  await podcast.setPairMeeting(db, pairId, { date: "2030-11-03", time: "16:00", place: "בספרייה" });
  const [pair] = await podcast.listPairs(db);
  expect(pair).toMatchObject({ meeting_date: "2030-11-03", meeting_time: "16:00" });
  expect(pair.members.map((m) => m.name).sort()).toEqual(["A", "B"]);
  expect(await lookupStatus(db, "0521111111", a.code)).toEqual([{ type: "podcast", status: "paired" }]);
});

test("podcast times: weekly times, choosing one (a JSON parameter), and a pair meeting at it", async () => {
  const first = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  const last = new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10);
  expect(await podcast.createPodcastTimes(db, { time_date: first, start_time: "10:00", end_time: "11:00", place_he: "בלובי", place_en: null, pairs: 1 }, last)).toBe(2);
  const [time] = await podcast.listUpcomingTimes(db);
  expect(time).toMatchObject({ time_date: first, residents: 0, students: 0, open: true });
  expect(time.starts_at).toBeInstanceOf(Date);
  const base = { email: null, topics: ["music"], language: "he", availability: null, registered_by: null, time_id: time.id };
  const a = await podcast.joinPodcastAt(db, { ...base, name: "T1", phone: "0531111111", portal: "resident" });
  const b = await podcast.joinPodcastAt(db, { ...base, name: "T2", phone: "0532222222", portal: "student" });
  expect((await podcast.joinPodcastAt(db, { ...base, name: "T3", phone: "0533333333", portal: "resident" })).status).toBe("full");
  if (a.status !== "joined" || b.status !== "joined") throw new Error("not joined");
  expect((await podcast.getParticipant(db, a.id))?.topics).toEqual(["music"]);
  const pairId = (await podcast.makePair(db, a.id, b.id))!;
  expect(await podcast.getPairMeeting(db, pairId)).toEqual({ date: first, time: "10:00", place: "בלובי" });
});

test("rate limit through the driver", async () => {
  expect(await hitRateLimit(db, "drv", 1, 60)).toBe(true);
  expect(await hitRateLimit(db, "drv", 1, 60)).toBe(false);
});

test("a database that never answers makes the query fail instead of hanging the page", async () => {
  // accepts the connection and then says nothing, like a connection the pooler silently dropped
  const silent = createServer(() => {});
  await new Promise<void>((resolve) => silent.listen(55433, "127.0.0.1", resolve));
  const stuck = postgresDb("postgres://postgres:postgres@127.0.0.1:55433/postgres", { max: 1, ssl: false, connectTimeoutMs: 30_000 }, 300);
  try {
    await expect(stuck.db.query("select 1")).rejects.toBeInstanceOf(DbTimeoutError);
  } finally {
    void stuck.end().catch(() => {});
    silent.close();
  }
});

const realPostgres = process.env.TEST_POSTGRES_URL;

test.skipIf(!realPostgres)("through the pooler stand-in, a real Postgres answers queries with values", async () => {
  const target = new URL(realPostgres!);
  const port = POOLER_PORT + 1;
  const proxy = await poolerStandIn(port, Number(target.port || 5432), target.hostname);
  target.hostname = "127.0.0.1";
  target.port = String(port);
  const real = postgresDb(target.toString(), { max: 2, ssl: false }, 3000);
  try {
    const rows = await Promise.all([
      real.db.query<{ x: number; j: { a: number } }>("select $1::int as x, $2::text::jsonb as j", [2, JSON.stringify({ a: 1 })]),
      real.db.query<{ y: string }>("select $1::text as y", ["two at once"]),
    ]);
    expect(rows[0][0]).toEqual({ x: 2, j: { a: 1 } });
    expect(rows[1][0].y).toBe("two at once");
  } finally {
    await real.end();
    proxy.close();
  }
});
