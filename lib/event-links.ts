import { eventForm, registrationOpen, type CalendarEvent } from "@/lib/calendar/parse";

export type EventAction =
  | { kind: "link"; href: string; label: "register" | "podcast"; full: boolean }
  | { kind: "closed" }
  | null;

/**
 * The registration button for an event in a portal: tagged events get the matching form,
 * untagged events get none.
 */
export function eventAction(
  event: CalendarEvent,
  portal: "students" | "residents",
  confirmed: number | undefined,
  now = new Date(),
): EventAction {
  const form = eventForm(event);
  if (!form) return null;
  if (form === "podcast") return { kind: "link", href: `/${portal}/podcast`, label: "podcast", full: false };
  if (!registrationOpen(event, now)) return { kind: "closed" };
  const full = event.capacity !== undefined && (confirmed ?? 0) >= event.capacity;
  return { kind: "link", href: `/${portal}/register?event=${encodeURIComponent(event.key)}`, label: "register", full };
}
