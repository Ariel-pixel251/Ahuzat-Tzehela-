import "server-only";
import { getCalendar, type CalendarEvent } from "@/lib/calendar";
import { confirmedCounts } from "@/lib/db/events";
import { tryDb } from "@/lib/server";

/** Upcoming events plus confirmed counts for those with a capacity (for "full" notes). */
export async function upcomingWithCounts(filter?: (e: CalendarEvent) => boolean) {
  const calendar = await getCalendar();
  const events = filter ? calendar.upcoming.filter(filter) : calendar.upcoming;
  let counts = new Map<string, number>();
  const withCapacity = events.filter((e) => e.capacity !== undefined).map((e) => e.key);
  if (withCapacity.length) {
    try {
      const db = await tryDb();
      if (db) counts = await confirmedCounts(db, withCapacity);
    } catch (err) {
      console.error("[events] counts unavailable", err);
    }
  }
  return { events, counts, source: calendar.source };
}
