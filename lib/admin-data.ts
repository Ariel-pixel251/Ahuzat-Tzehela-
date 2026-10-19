import "server-only";
import type { CalendarData } from "@/lib/calendar";
import { eventHealth, type EventHealth } from "@/lib/calendar/status";
import { listRegistrations, type Registration } from "@/lib/db/events";
import type { Db } from "@/lib/db/types";

export type EventSummary = {
  key: string;
  titleEn: string;
  titleHe: string;
  date: string;
  time: string | null;
  health: EventHealth;
  /** current calendar date/time when it moved */
  currentWhen: string | null;
  confirmedPeople: number;
  waitlistPeople: number;
  registrations: Registration[];
  noticeSent: boolean;
};

/** All registrations grouped by calendar event (past events included), with calendar health. */
export async function eventSummaries(db: Db, calendar: CalendarData): Promise<EventSummary[]> {
  const regs = await listRegistrations(db);
  const health = eventHealth(regs, calendar);
  const groups = new Map<string, Registration[]>();
  for (const r of regs) groups.set(r.event_key, [...(groups.get(r.event_key) ?? []), r]);
  return [...groups.entries()]
    .map(([key, list]) => {
      const h = health.get(key)!;
      const first = list[0];
      const active = list.filter((r) => r.status !== "cancelled");
      return {
        key,
        titleEn: h.current?.title.en ?? first.event_title_en,
        titleHe: h.current?.title.he ?? first.event_title_he,
        date: first.event_date,
        time: first.event_time,
        health: h.health,
        currentWhen: h.health === "time-changed" && h.current ? `${h.current.date} ${h.current.startTime ?? ""}`.trim() : null,
        confirmedPeople: active.filter((r) => r.status === "confirmed").reduce((n, r) => n + r.attendees, 0),
        waitlistPeople: active.filter((r) => r.status === "waitlist").reduce((n, r) => n + r.attendees, 0),
        registrations: list,
        noticeSent: active.some((r) => r.cancel_notice_sent_at),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export const HEALTH_LABEL: Record<EventHealth, string> = {
  scheduled: "Scheduled",
  "time-changed": "Time changed",
  cancelled: "Cancelled in calendar",
  removed: "Removed from calendar",
  past: "Past",
  unknown: "Unknown (calendar offline)",
};
