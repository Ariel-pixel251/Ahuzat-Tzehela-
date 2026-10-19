import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { afterAll, beforeAll, expect, test } from "vitest";
import * as digital from "@/lib/db/digital";
import * as events from "@/lib/db/events";
import { getSetting, hitRateLimit, lookupStatus, setSetting } from "@/lib/db/misc";
import * as podcast from "@/lib/db/podcast";
import { postgresDb } from "@/lib/db/postgres";
import type { Db } from "@/lib/db/types";
import { applyMigrations } from "@/lib/db/migrate";

// The production driver (postgres.js, as used with Supabase) over the real Postgres wire protocol.
// The other database tests call PGlite directly, which binds parameters differently; this file
// catches driver differences such as JSON parameters being encoded twice.

const PORT = 55432;
let server: PGLiteSocketServer;
let pg: PGlite;
let db: Db;
let end: () => Promise<void>;

beforeAll(async () => {
  pg = new PGlite();
  await applyMigrations(pg, { seed: true });
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1" });
  await server.start();
  ({ db, end } = postgresDb(`postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`, { max: 1, ssl: false }));
});

afterAll(async () => {
  await end?.();
  await server?.stop();
  await pg?.close();
});

test("lists (needs, days) are saved as lists", async () => {
  const { id } = await digital.createDigitalRequest(db, {
    resident_name: "רבקה כהן",
    resident_phone: "0501234567",
    resident_email: null,
    needs: ["whatsapp", "banking"],
    needs_other: null,
    preferred_days: ["sun", "tue"],
    preferred_parts: ["morning"],
    language: "he",
    registered_by: null,
  });
  const row = await digital.getDigitalRequest(db, id);
  expect(row).toMatchObject({ needs: ["whatsapp", "banking"], preferred_days: ["sun", "tue"], preferred_parts: ["morning"] });
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
    role: null,
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
  await setSetting(db, "require_match_approval", false);
  expect(await getSetting(db, "require_match_approval", true)).toBe(false);
  await setSetting(db, "require_match_approval", true);
  expect(await getSetting(db, "require_match_approval", false)).toBe(true);
});

test("podcast topics, pairs and the status lookup", async () => {
  const join = (name: string, phone: string) =>
    podcast.joinPodcast(db, { name, email: null, phone, portal: "resident", topics: ["music", "history"], language: "he", availability: null, registered_by: null });
  const a = (await join("A", "0521111111"))!;
  const b = (await join("B", "0522222222"))!;
  expect((await podcast.getParticipant(db, a.id))?.topics).toEqual(["music", "history"]);
  expect(await podcast.makePair(db, a.id, b.id)).toBeTruthy();
  const [pair] = await podcast.listPairs(db);
  expect(pair.members.map((m) => m.name).sort()).toEqual(["A", "B"]);
  expect(await lookupStatus(db, "0521111111", a.code)).toEqual([{ type: "podcast", status: "paired" }]);
});

test("rate limit through the driver", async () => {
  expect(await hitRateLimit(db, "drv", 1, 60)).toBe(true);
  expect(await hitRateLimit(db, "drv", 1, 60)).toBe(false);
});
