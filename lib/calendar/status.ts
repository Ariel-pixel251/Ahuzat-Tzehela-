import type { CalendarData } from "./load";
import { todayInJerusalem, type CalendarEvent } from "./parse";

export type EventHealth = "scheduled" | "time-changed" | "cancelled" | "removed" | "past" | "unknown";

export type RegisteredEventSnapshot = {
  event_key: string;
  event_date: string;
  event_time: string | null;
};

export type EventStatusRow = {
  key: string;
  health: EventHealth;
  /** The event as it is in the calendar now, if it is there */
  current: CalendarEvent | null;
  /** Snapshot taken at registration (the earliest registration's) */
  snapshot: RegisteredEventSnapshot;
};

/**
 * Compares registrations (which keep a snapshot of the event) with the live calendar:
 * cancelled, removed, or moved events are flagged; registrations are never deleted here.
 */
export function eventHealth(
  registrations: RegisteredEventSnapshot[],
  calendar: Pick<CalendarData, "all" | "cancelled" | "source">,
  now = new Date(),
): Map<string, EventStatusRow> {
  const today = todayInJerusalem(now);
  const byKey = new Map(calendar.all.map((e) => [e.key, e]));
  const cancelled = new Set(calendar.cancelled.map((c) => c.key));
  const result = new Map<string, EventStatusRow>();

  for (const r of registrations) {
    const existing = result.get(r.event_key);
    const current = byKey.get(r.event_key) ?? null;
    let health: EventHealth;
    if (cancelled.has(r.event_key)) health = "cancelled";
    else if (current) {
      const moved = current.date !== r.event_date || (current.startTime ?? null) !== (r.event_time ?? null);
      health = moved ? "time-changed" : (current.endDate ?? current.date) < today ? "past" : "scheduled";
    } else if (r.event_date < today) health = "past";
    else health = calendar.source === "seed" ? "unknown" : "removed";

    // one moved snapshot is enough to flag the event
    if (!existing || (existing.health === "scheduled" && health === "time-changed")) {
      result.set(r.event_key, { key: r.event_key, health, current, snapshot: existing?.snapshot ?? r });
    }
  }
  return result;
}
