import { parseIcs, parseSeed, upcoming, type CalendarEvent, type CancelledOccurrence, type SeedEvent } from "./parse";

export type CalendarData = {
  /** All parsed events in the window (past ~4 months to ~13 months ahead). */
  all: CalendarEvent[];
  /** Events that haven't ended yet. */
  upcoming: CalendarEvent[];
  cancelled: CancelledOccurrence[];
  /** "calendar" when the feed was read; "seed" when it failed and the offline fallback is shown. */
  source: "calendar" | "seed";
  error?: string;
};

/**
 * Reads the calendar feed. The seed file is used ONLY when the feed can't be fetched or
 * parsed, so the page never crashes; when the feed works its events are the only ones shown.
 */
export async function loadCalendar(fetchIcs: () => Promise<string>, seed: SeedEvent[], now = new Date()): Promise<CalendarData> {
  try {
    const { events, cancelled } = parseIcs(await fetchIcs(), { now });
    return { all: events, upcoming: upcoming(events, now), cancelled, source: "calendar" };
  } catch (err) {
    const events = parseSeed(seed);
    return {
      all: events,
      upcoming: upcoming(events, now),
      cancelled: [],
      source: "seed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
