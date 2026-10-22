import type { CalendarEvent } from "@/lib/calendar/parse";

export type Locale = "en" | "he";

const day = {
  he: new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }),
  en: new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }),
};
const shortDay = {
  he: new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", timeZone: "UTC" }),
  en: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
};
const month = {
  he: new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric", timeZone: "UTC" }),
  en: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
};
const weekday = {
  he: new Intl.DateTimeFormat("he-IL", { weekday: "short", timeZone: "UTC" }),
  en: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }),
};

const asDate = (d: string) => new Date(`${d}T12:00:00Z`);

/** "יום שני, 1 בנובמבר" / "Monday 1 November" */
export function formatDay(date: string, locale: Locale) {
  return day[locale].format(asDate(date));
}

/** "יום שני, 1 בנובמבר, בשעה 17:30" / "Monday 1 November, 17:30" */
export function formatDateTime(date: string, time: string | null | undefined, locale: Locale) {
  const d = formatDay(date, locale);
  if (!time) return d;
  return locale === "he" ? `${d}, בשעה ${time}` : `${d}, ${time}`;
}

/** Full plain-words date line for an event, including multi-day and end time. */
export function formatEventWhen(e: Pick<CalendarEvent, "date" | "endDate" | "startTime" | "endTime">, locale: Locale) {
  if (e.endDate) {
    return locale === "he"
      ? `מ${formatDay(e.date, "he")} עד ${formatDay(e.endDate, "he")}`
      : `${formatDay(e.date, "en")} – ${formatDay(e.endDate, "en")}`;
  }
  if (!e.startTime) return formatDay(e.date, locale);
  const end = e.endTime ? (locale === "he" ? ` עד ${e.endTime}` : `–${e.endTime}`) : "";
  return locale === "he" ? `${formatDay(e.date, "he")}, בשעה ${e.startTime}${end}` : `${formatDay(e.date, "en")}, ${e.startTime}${end}`;
}

/** "נובמבר 2026" / "November 2026" from "2026-11" */
export function formatMonth(yyyyMm: string, locale: Locale) {
  return month[locale].format(asDate(`${yyyyMm}-01`));
}

/** Short pieces for agenda date badges */
export function dateBadge(date: string, locale: Locale) {
  const d = asDate(date);
  return { day: String(d.getUTCDate()), weekday: weekday[locale].format(d), short: shortDay[locale].format(d) };
}

/** "יום שלישי, 3 בנובמבר, 16:00 עד 17:30" / "Tuesday 3 November, 16:00–17:30" */
export function formatSlotWhen(s: { slot_date: string; start_time: string; end_time: string }, locale: Locale) {
  return locale === "he"
    ? `${formatDay(s.slot_date, "he")}, ${s.start_time} עד ${s.end_time}`
    : `${formatDay(s.slot_date, "en")}, ${s.start_time}–${s.end_time}`;
}

/** A podcast time (set by the team) in one line, like a slot. */
export function formatPodcastTime(t: { time_date: string; start_time: string; end_time: string; place_he: string; place_en: string | null }, locale: Locale) {
  return formatSlot({ ...t, slot_date: t.time_date }, locale);
}

/** The slot's time and place in one line, e.g. "יום שלישי, 3 בנובמבר, 16:00 עד 17:30, בחדר הקהילה". */
export function formatSlot(s: { slot_date: string; start_time: string; end_time: string; place_he: string; place_en: string | null }, locale: Locale) {
  const place = locale === "he" ? s.place_he : (s.place_en ?? s.place_he);
  return `${formatSlotWhen(s, locale)}, ${place}`;
}
