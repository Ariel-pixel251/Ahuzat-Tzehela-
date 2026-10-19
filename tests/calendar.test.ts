import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import seed from "@/data/events.seed.json";
import { loadCalendar } from "@/lib/calendar/load";
import {
  eventForm,
  extractControls,
  groupByMonth,
  parseIcs,
  parseSeed,
  registrationOpen,
  splitDescription,
  splitTitle,
  type SeedEvent,
} from "@/lib/calendar/parse";
import { eventHealth } from "@/lib/calendar/status";

const ics = readFileSync(path.join(import.meta.dirname, "fixtures/google.ics"), "utf8");
const NOW = new Date("2026-10-19T09:00:00Z");
const parsed = parseIcs(ics, { now: NOW });
const feed = { all: parsed.events, cancelled: parsed.cancelled, source: "calendar" as const };
const byUid = (uid: string) => parsed.events.filter((e) => e.uid === uid);

describe("bilingual conventions", () => {
  test("title splits on the first |", () => {
    expect(splitTitle("Board games | ערב משחקים")).toEqual({ en: "Board games", he: "ערב משחקים" });
    expect(splitTitle("Only one language")).toEqual({ en: "Only one language", he: "Only one language" });
  });

  test("description splits on a line containing only ---", () => {
    expect(splitDescription("Hello\nthere\n---\nשלום")).toEqual({ en: "Hello\nthere", he: "שלום" });
    expect(splitDescription("No separator -- here")).toEqual({ en: "No separator -- here", he: "No separator -- here" });
  });

  test("parsed event shows English and Hebrew parts", () => {
    const [games] = byUid("games-1@google.com");
    expect(games.title).toEqual({ en: "Board games night", he: "ערב משחקי קופסה" });
    expect(games.description).toEqual({ en: "Bring a friend!", he: "הביאו חבר!" });
    expect(games.location).toEqual({ en: "Main hall", he: "האולם המרכזי" });
  });

  test("HTML descriptions from Google are turned into text", () => {
    const [party] = byUid("party-1@google.com");
    expect(party.description?.en).toBe("Candles and sufganiyot");
  });
});

describe("tags and options", () => {
  test("tags and options are extracted and removed from the text", () => {
    const into = { tags: [], languages: false, tbc: false } as Parameters<typeof extractControls>[1];
    const text = extractControls("Party [party] [capacity: 30] [closes: 2026-11-10] [languages] [unknown]", into);
    expect(text).toBe("Party [unknown]");
    expect(into).toMatchObject({ tags: ["party"], capacity: 30, closes: "2026-11-10", languages: true });
  });

  test("tags in the title or description both count", () => {
    const [games] = byUid("games-1@google.com");
    expect(games.tags).toEqual(["game-night"]);
    expect(games.capacity).toBe(30);
    expect(games.closes).toBe("2026-10-30");
    const [lang] = byUid("lang-1@google.com");
    expect(lang.tags).toEqual(["language-night"]);
    expect(lang.description).toBeUndefined();
    const [party] = byUid("party-1@google.com");
    expect(party.tags).toEqual(["party"]);
    expect(party.languages).toBe(true);
  });

  test("TBC marks the event and is removed from the title", () => {
    const [visit] = byUid("visit-1@google.com");
    expect(visit.tbc).toBe(true);
    expect(visit.title.en).toBe("Yocopas visit");
  });

  test("the tag decides the registration form; no tag, no button", () => {
    expect(eventForm({ tags: ["language-night"] })).toBe("language-night");
    expect(eventForm({ tags: ["party"] })).toBe("general");
    expect(eventForm({ tags: ["memorial"] })).toBe("memorial");
    expect(eventForm({ tags: ["digital-support"] })).toBe("digital-support");
    expect(eventForm({ tags: [] })).toBeNull();
    expect(byUid("untagged-1@google.com")[0].tags).toEqual([]);
  });
});

describe("dates and times", () => {
  test("times are shown in Israel time, from TZID or UTC", () => {
    expect(byUid("games-1@google.com")[0]).toMatchObject({ date: "2026-11-01", startTime: "17:30", endTime: "19:30" });
    // 16:30Z in November (UTC+2) is 18:30 in Israel
    expect(byUid("lang-1@google.com")[0]).toMatchObject({ date: "2026-11-16", startTime: "18:30" });
    // daylight saving time in October (UTC+3)
    expect(byUid("untagged-1@google.com")[0]).toMatchObject({ date: "2026-10-20", startTime: "10:00" });
  });

  test("all-day and multi-day events (DTEND is exclusive)", () => {
    const [party] = byUid("party-1@google.com");
    expect(party).toMatchObject({ allDay: true, date: "2026-12-10" });
    expect(party.endDate).toBeUndefined();
    const [visit] = byUid("visit-1@google.com");
    expect(visit).toMatchObject({ allDay: true, date: "2026-12-14", endDate: "2026-12-15" });
  });

  test("recurring events are expanded with EXDATE, moved and cancelled occurrences", () => {
    const club = byUid("club-1@google.com");
    expect(club.map((e) => `${e.date} ${e.startTime}`)).toEqual([
      "2026-11-05 16:00",
      // 11-12 removed by EXDATE
      "2026-11-19 18:00", // moved occurrence
      // 11-26 cancelled
      "2026-12-03 16:00",
    ]);
    expect(club[1].title.en).toBe("Conversation club (moved)");
    // the key of each occurrence is UID + original occurrence date, stable when moved
    expect(club.map((e) => e.key)).toEqual([
      "club-1@google.com::2026-11-05",
      "club-1@google.com::2026-11-19",
      "club-1@google.com::2026-12-03",
    ]);
  });

  test("cancelled events are not shown but are reported", () => {
    expect(byUid("cancelled-1@google.com")).toHaveLength(0);
    expect(parsed.cancelled.map((c) => c.key).sort()).toEqual(["cancelled-1@google.com", "club-1@google.com::2026-11-26"]);
  });

  test("events far in the past are skipped and the list is sorted", () => {
    expect(byUid("old-1@google.com")).toHaveLength(0);
    const keys = parsed.events.map((e) => `${e.date} ${e.startTime ?? ""}`);
    expect([...keys].sort()).toEqual(keys);
  });

  test("registration closes after the deadline or once the event started", () => {
    const [games] = byUid("games-1@google.com");
    expect(registrationOpen(games, NOW)).toBe(true);
    expect(registrationOpen(games, new Date("2026-10-31T09:00:00Z"))).toBe(false);
    const [lang] = byUid("lang-1@google.com");
    expect(registrationOpen(lang, new Date("2026-11-16T16:00:00Z"))).toBe(true); // 18:00 Israel
    expect(registrationOpen(lang, new Date("2026-11-16T16:31:00Z"))).toBe(false);
  });

  test("events group by month", () => {
    const groups = groupByMonth(parsed.events);
    expect(groups.map((g) => g.month)).toEqual(["2026-10", "2026-11", "2026-12"]);
  });
});

describe("fallback to the seed file", () => {
  test("uses the feed when it works, and never mixes in seed events", async () => {
    const data = await loadCalendar(async () => ics, seed as SeedEvent[], NOW);
    expect(data.source).toBe("calendar");
    expect(data.all.some((e) => e.key.startsWith("seed-"))).toBe(false);
    expect(data.upcoming.map((e) => e.uid)).not.toContain("old-1@google.com");
  });

  test("falls back to the seed when the fetch fails or the feed is not iCal", async () => {
    const failed = await loadCalendar(async () => Promise.reject(new Error("offline")), seed as SeedEvent[], NOW);
    expect(failed.source).toBe("seed");
    expect(failed.error).toBe("offline");
    expect(failed.upcoming).toHaveLength(6);
    const html = await loadCalendar(async () => "<html>Not found</html>", seed as SeedEvent[], NOW);
    expect(html.source).toBe("seed");
  });

  test("an empty but valid feed shows no events (the seed is only for failures)", async () => {
    const data = await loadCalendar(async () => "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR", seed as SeedEvent[], NOW);
    expect(data).toMatchObject({ source: "calendar", all: [] });
  });

  test("seed events follow the same conventions", () => {
    const events = parseSeed(seed as SeedEvent[]);
    expect(events[0]).toMatchObject({
      date: "2026-11-01",
      startTime: "17:30",
      tags: ["game-night"],
      title: { en: "Board games night", he: "ערב משחקי קופסה" },
    });
    const visit = events.find((e) => e.key === "seed-yocopas-visit-2026-12-14")!;
    expect(visit).toMatchObject({ allDay: true, endDate: "2026-12-15", tbc: true, tags: ["visit"] });
  });

  test("seed events are shown but never open for registration", () => {
    const events = parseSeed(seed as SeedEvent[]);
    expect(events.every((e) => e.offline)).toBe(true);
    expect(events.map(eventForm)).toEqual([null, null, null, null, null, null]);
  });
});

describe("registrations linked by UID survive calendar changes", () => {
  const snapshot = (event_key: string, event_date: string, event_time: string | null) => ({ event_key, event_date, event_time });

  test("scheduled, moved, cancelled, removed and past events are told apart", () => {
    const health = eventHealth(
      [
        snapshot("games-1@google.com", "2026-11-01", "17:30"),
        snapshot("lang-1@google.com", "2026-11-16", "17:00"),
        snapshot("cancelled-1@google.com", "2026-11-20", "10:00"),
        snapshot("club-1@google.com::2026-11-26", "2026-11-26", "16:00"),
        snapshot("deleted-1@google.com", "2026-12-01", null),
        snapshot("ancient@google.com", "2026-01-01", null),
      ],
      feed,
      NOW,
    );
    expect(Object.fromEntries([...health].map(([k, v]) => [k, v.health]))).toEqual({
      "games-1@google.com": "scheduled",
      "lang-1@google.com": "time-changed",
      "cancelled-1@google.com": "cancelled",
      "club-1@google.com::2026-11-26": "cancelled",
      "deleted-1@google.com": "removed",
      "ancient@google.com": "past",
    });
    // the current calendar time is available for reminders
    expect(health.get("lang-1@google.com")?.current?.startTime).toBe("18:30");
  });

  test("a moved recurring occurrence keeps its key", () => {
    const health = eventHealth([snapshot("club-1@google.com::2026-11-19", "2026-11-19", "16:00")], feed, NOW);
    expect(health.get("club-1@google.com::2026-11-19")).toMatchObject({ health: "time-changed" });
  });

  test("while the feed is down, missing events are 'unknown', not 'removed'", () => {
    const health = eventHealth([snapshot("games-1@google.com", "2026-11-01", "17:30")], { all: [], cancelled: [], source: "seed" }, NOW);
    expect(health.get("games-1@google.com")?.health).toBe("unknown");
  });
});
