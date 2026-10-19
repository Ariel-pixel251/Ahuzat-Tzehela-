import "server-only";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { cache } from "react";
import seed from "@/data/events.seed.json";
import { loadCalendar } from "./load";
import type { SeedEvent } from "./parse";

export * from "./parse";
export type { CalendarData } from "./load";

/** The public iCal feed of the "Ahuzat Tzahala Events" Google Calendar (not a secret). */
export const DEFAULT_ICS_URL =
  "https://calendar.google.com/calendar/ical/123c81be1e033ed38834159a732f300ead0ba52aff9f5c466fce5c9195239efd%40group.calendar.google.com/public/basic.ics";

const REVALIDATE_SECONDS = 600;

async function fetchIcs(): Promise<string> {
  const url = process.env.GOOGLE_CALENDAR_ICS_URL || DEFAULT_ICS_URL;
  // file:// is used by the end-to-end tests to load a fixture feed
  if (url.startsWith("file:")) return readFile(fileURLToPath(url), "utf8");
  const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Calendar feed returned HTTP ${res.status}`);
  return res.text();
}

/** Calendar data for this request (server only; the feed is cached ~10 minutes). */
export const getCalendar = cache(async () => {
  const data = await loadCalendar(fetchIcs, seed as SeedEvent[]);
  if (data.source === "seed") console.warn(`[calendar] feed unavailable, showing seed events: ${data.error}`);
  return data;
});

export async function getEvent(key: string) {
  const { all } = await getCalendar();
  return all.find((e) => e.key === key) ?? null;
}
