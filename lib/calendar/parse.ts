import ICAL from "ical.js";

/**
 * Calendar conventions (see README "How to add an event"):
 *   Title:        "English title | כותרת בעברית"
 *   Description:  English text, a line containing only "---", then Hebrew text
 *   Tags:         [game-night] [language-night] [podcast] [party] [lecture] [register]
 *                 (title or description)
 *   Options:      [capacity: 30]  [closes: 2026-11-10]  [languages]  [tbc]
 * Tags and options are removed from the displayed text.
 */

export const TAGS = ["game-night", "language-night", "podcast", "party", "lecture", "register"] as const;
export type Tag = (typeof TAGS)[number];

export type Bilingual = { en: string; he: string };

export type CalendarEvent = {
  /** iCal UID, or UID + "::" + occurrence date (YYYY-MM-DD) for recurring events. */
  key: string;
  uid: string;
  allDay: boolean;
  /** Israel-time date YYYY-MM-DD */
  date: string;
  /** Last day (inclusive) of a multi-day event */
  endDate?: string;
  /** Israel-time HH:MM, timed events only */
  startTime?: string;
  endTime?: string;
  title: Bilingual;
  description?: Bilingual;
  location?: Bilingual;
  tags: Tag[];
  capacity?: number;
  /** Last day (inclusive) to register */
  closes?: string;
  /** Show the language choice on this event's form */
  languages: boolean;
  /** Details still to be confirmed */
  tbc: boolean;
  /** From the offline seed file (feed unavailable): shown, but not open for registration */
  offline?: boolean;
};

export type CancelledOccurrence = { key: string; uid: string; date: string };
export type ParsedCalendar = { events: CalendarEvent[]; cancelled: CancelledOccurrence[] };

export const TIME_ZONE = "Asia/Jerusalem";

// ---------------------------------------------------------------- text conventions

type Controls = Pick<CalendarEvent, "tags" | "capacity" | "closes" | "languages" | "tbc">;

const MARKER = /\[\s*([a-z-]+)\s*(?::\s*([^\]]*?))?\s*\]/gi;

/** Pulls tags/options out of the text and returns the cleaned text. */
export function extractControls(text: string, into: Controls): string {
  const cleaned = text.replace(MARKER, (match, rawName: string, rawValue?: string) => {
    const name = rawName.toLowerCase();
    if ((TAGS as readonly string[]).includes(name) && rawValue === undefined) {
      if (!into.tags.includes(name as Tag)) into.tags.push(name as Tag);
      return "";
    }
    if (name === "capacity" && rawValue && /^\d+$/.test(rawValue.trim())) {
      into.capacity = Number(rawValue.trim());
      return "";
    }
    if (name === "closes" && rawValue && /^\d{4}-\d{2}-\d{2}$/.test(rawValue.trim())) {
      into.closes = rawValue.trim();
      return "";
    }
    if (name === "languages" && rawValue === undefined) {
      into.languages = true;
      return "";
    }
    if (name === "tbc" && rawValue === undefined) {
      into.tbc = true;
      return "";
    }
    return match;
  });
  // A plain "TBC" in the text also marks the event; "(TBC)" / "TBC" is then removed.
  const withoutTbc = cleaned.replace(/\(\s*TBC\s*\)|\bTBC\b/g, () => {
    into.tbc = true;
    return "";
  });
  return tidy(withoutTbc);
}

function tidy(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/^[|\s]+$/, "");
}

/** "English | עברית" → both parts; without "|" the same text in both. */
export function splitTitle(text: string): Bilingual {
  const i = text.indexOf("|");
  if (i === -1) return { en: text.trim(), he: text.trim() };
  const en = text.slice(0, i).trim();
  const he = text.slice(i + 1).trim();
  return { en: en || he, he: he || en };
}

/** English text, a line with only "---", then Hebrew text; without it the same text in both. */
export function splitDescription(text: string): Bilingual {
  const lines = text.split(/\r?\n/);
  const i = lines.findIndex((l) => l.trim() === "---");
  if (i === -1) return { en: text.trim(), he: text.trim() };
  const en = lines.slice(0, i).join("\n").trim();
  const he = lines.slice(i + 1).join("\n").trim();
  return { en: en || he, he: he || en };
}

/** Google Calendar sometimes stores descriptions as simple HTML. */
export function htmlToText(text: string): string {
  if (!/[<&]/.test(text)) return text;
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

type RawEvent = {
  uid: string;
  key: string;
  allDay: boolean;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  summary: string;
  description: string;
  location: string;
  extraTags?: string[];
  tbc?: boolean;
};

/** Applies the title/description/location conventions to a raw event. */
export function normalize(raw: RawEvent): CalendarEvent {
  const controls: Controls = { tags: [], languages: false, tbc: Boolean(raw.tbc) };
  for (const t of raw.extraTags ?? []) {
    if ((TAGS as readonly string[]).includes(t) && !controls.tags.includes(t as Tag)) controls.tags.push(t as Tag);
  }
  const title = extractControls(raw.summary, controls);
  const description = extractControls(htmlToText(raw.description), controls);
  const location = extractControls(raw.location, controls);
  return {
    key: raw.key,
    uid: raw.uid,
    allDay: raw.allDay,
    date: raw.date,
    ...(raw.endDate && raw.endDate > raw.date ? { endDate: raw.endDate } : {}),
    ...(raw.startTime ? { startTime: raw.startTime } : {}),
    ...(raw.endTime ? { endTime: raw.endTime } : {}),
    title: splitTitle(title || raw.uid),
    ...(description ? { description: splitDescription(description) } : {}),
    ...(location ? { location: splitTitle(location) } : {}),
    ...controls,
  };
}

// ---------------------------------------------------------------- dates

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Israel-time date and time of an instant. */
export function jerusalemParts(d: Date): { date: string; time: string } {
  const p = Object.fromEntries(partsFormatter.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export function todayInJerusalem(now = new Date()): string {
  return jerusalemParts(now).date;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateOnly(t: ICAL.Time): string {
  return `${t.year}-${pad(t.month)}-${pad(t.day)}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function timing(start: ICAL.Time, end: ICAL.Time | null) {
  if (start.isDate) {
    const date = dateOnly(start);
    // DTEND of an all-day event is exclusive
    const endDate = end ? addDays(dateOnly(end), -1) : undefined;
    return { allDay: true, date, endDate };
  }
  const s = jerusalemParts(start.toJSDate());
  if (!end) return { allDay: false, date: s.date, startTime: s.time };
  // an event ending exactly at midnight ends on the previous day
  const e = jerusalemParts(new Date(end.toJSDate().getTime() - 60_000));
  const eExact = jerusalemParts(end.toJSDate());
  return { allDay: false, date: s.date, startTime: s.time, endTime: eExact.time, endDate: e.date };
}

function occurrenceDate(t: ICAL.Time): string {
  return t.isDate ? dateOnly(t) : jerusalemParts(t.toJSDate()).date;
}

// ---------------------------------------------------------------- iCal

export type ParseOptions = { now?: Date; pastDays?: number; futureDays?: number };

/**
 * Parses an iCal feed: expands recurring events within the window, applies exceptions,
 * collects cancelled occurrences, and normalises everything to Israel time.
 */
export function parseIcs(ics: string, { now = new Date(), pastDays = 120, futureDays = 400 }: ParseOptions = {}): ParsedCalendar {
  if (!/BEGIN:VCALENDAR/.test(ics)) throw new Error("Not an iCal feed");
  const root = new ICAL.Component(ICAL.parse(ics));
  for (const tz of root.getAllSubcomponents("vtimezone")) {
    const zone = new ICAL.Timezone(tz);
    if (!ICAL.TimezoneService.has(zone.tzid)) ICAL.TimezoneService.register(zone, zone.tzid);
  }
  const rangeStart = new Date(now.getTime() - pastDays * 86_400_000);
  const rangeEnd = new Date(now.getTime() + futureDays * 86_400_000);

  const vevents = root.getAllSubcomponents("vevent");
  const exceptions = new Map<string, ICAL.Component[]>();
  const masters: ICAL.Component[] = [];
  for (const v of vevents) {
    if (v.hasProperty("recurrence-id")) {
      const uid = String(v.getFirstPropertyValue("uid"));
      exceptions.set(uid, [...(exceptions.get(uid) ?? []), v]);
    } else masters.push(v);
  }

  const events: CalendarEvent[] = [];
  const cancelled: CancelledOccurrence[] = [];
  const text = (c: ICAL.Component, name: string) => String(c.getFirstPropertyValue(name) ?? "");
  const isCancelled = (c: ICAL.Component) => text(c, "status").toUpperCase() === "CANCELLED";

  const push = (item: ICAL.Component, key: string, uid: string, start: ICAL.Time, end: ICAL.Time | null) => {
    const when = timing(start, end);
    if (isCancelled(item)) {
      cancelled.push({ key, uid, date: when.date });
      return;
    }
    events.push(
      normalize({
        uid,
        key,
        ...when,
        summary: text(item, "summary"),
        description: text(item, "description"),
        location: text(item, "location"),
      }),
    );
  };

  for (const master of masters) {
    const uid = text(master, "uid");
    if (!uid) continue;
    const event = new ICAL.Event(master, { strictExceptions: false, exceptions: exceptions.get(uid) ?? [] });
    if (!event.isRecurring()) {
      if (!event.startDate) continue;
      const end = event.endDate ?? null;
      const endsAt = (end ?? event.startDate).toJSDate();
      if (endsAt < rangeStart || event.startDate.toJSDate() > rangeEnd) continue;
      push(master, uid, uid, event.startDate, end);
      continue;
    }
    const iterator = event.iterator();
    for (let next = iterator.next(), n = 0; next && n < 2000; next = iterator.next(), n++) {
      if (next.toJSDate() > rangeEnd) break;
      const details = event.getOccurrenceDetails(next);
      const endsAt = (details.endDate ?? details.startDate).toJSDate();
      if (endsAt < rangeStart) continue;
      const key = `${uid}::${occurrenceDate(details.recurrenceId)}`;
      if (isCancelled(master)) {
        cancelled.push({ key, uid, date: occurrenceDate(details.startDate) });
        continue;
      }
      push(details.item.component, key, uid, details.startDate, details.endDate ?? null);
    }
  }
  events.sort((a, b) => `${a.date} ${a.startTime ?? ""}`.localeCompare(`${b.date} ${b.startTime ?? ""}`));
  return { events, cancelled };
}

// ---------------------------------------------------------------- seed fallback

export type SeedEvent = {
  id: string;
  title: string;
  /** "YYYY-MM-DD" (all day) or "YYYY-MM-DDTHH:MM" (Israel time) */
  start: string;
  /** Same format; for all-day events the last day (inclusive) */
  end?: string;
  location?: string;
  description?: string;
  tags?: string[];
  tbc?: boolean;
};

export function parseSeed(seed: SeedEvent[]): CalendarEvent[] {
  return seed
    .map((s) => {
      const [date, startTime] = s.start.split("T");
      const [endDate, endTime] = s.end ? s.end.split("T") : [undefined, undefined];
      return normalize({
        uid: s.id,
        key: s.id,
        allDay: !startTime,
        date,
        endDate: endDate && endDate !== date ? endDate : undefined,
        startTime,
        endTime,
        summary: s.title,
        description: s.description ?? "",
        location: s.location ?? "",
        extraTags: s.tags,
        tbc: s.tbc,
      });
    })
    // registrations must link to real calendar UIDs, so seed events can't be registered for
    .map((e) => ({ ...e, offline: true }))
    .sort((a, b) => `${a.date} ${a.startTime ?? ""}`.localeCompare(`${b.date} ${b.startTime ?? ""}`));
}

// ---------------------------------------------------------------- helpers

/** The Israel-time date `days` from today. */
export function daysFromToday(days: number, now = new Date()): string {
  return addDays(todayInJerusalem(now), days);
}

/** Events that have not ended yet (Israel time). */
export function upcoming(events: CalendarEvent[], now = new Date()): CalendarEvent[] {
  const today = todayInJerusalem(now);
  return events.filter((e) => (e.endDate ?? e.date) >= today);
}

/** Registration is open until the end of the `closes` day and while the event hasn't started. */
export function registrationOpen(event: CalendarEvent, now = new Date()): boolean {
  const today = todayInJerusalem(now);
  if (event.closes && today > event.closes) return false;
  if (event.date < today) return false;
  if (event.date === today && event.startTime && jerusalemParts(now).time >= event.startTime) return false;
  return true;
}

/** The form an event uses, from its tags. Null = no registration button. */
export type EventForm = "language-night" | "game-night" | "general" | "podcast";

export function eventForm(event: Pick<CalendarEvent, "tags" | "offline">): EventForm | null {
  if (event.offline) return null;
  const t = event.tags;
  if (t.includes("language-night")) return "language-night";
  if (t.includes("game-night")) return "game-night";
  if (t.some((x) => x === "lecture" || x === "party" || x === "register")) return "general";
  if (t.includes("podcast")) return "podcast";
  return null;
}

export function groupByMonth(events: CalendarEvent[]): { month: string; events: CalendarEvent[] }[] {
  const groups: { month: string; events: CalendarEvent[] }[] = [];
  for (const e of events) {
    const month = e.date.slice(0, 7);
    const last = groups.at(-1);
    if (last?.month === month) last.events.push(e);
    else groups.push({ month, events: [e] });
  }
  return groups;
}
