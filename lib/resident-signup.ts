import type { ExtraRow, SlotChoice } from "@/components/residents/SignUp";
import { LANGUAGES } from "@/config/languages";
import { DIGITAL_NEEDS } from "@/config/options";
import { eventForm, type CalendarEvent } from "@/lib/calendar/parse";
import { placesLeft, type PodcastTime } from "@/lib/db/podcast";
import { bookable, type Slot } from "@/lib/db/slots";
import { residentsText } from "@/lib/i18n";
import { formatDateTime } from "@/lib/i18n/format";

// What the residents' two sign-up screens show: the open slots as big buttons (full and past ones
// left out completely), and at most one extra row with the usual answer already chosen.

const s = residentsText.signup;
const opts = (list: readonly { code: string; he: string }[]) => list.map((o) => ({ value: o.code, label: o.he }));

/** "יום שני, 1 בדצמבר, בשעה 17:30 · בלובי" (the place already has its "ב") */
const label = (date: string, start: string, place: string) => s.slotLabel(formatDateTime(date, start, "he"), place);

/** Digital support slots a resident can book now. */
export function helpChoices(slots: Slot[], now = new Date()): SlotChoice[] {
  return slots.filter((x) => bookable(x, now)).map((x) => ({ value: x.id, label: label(x.slot_date, x.start_time, x.place_he) }));
}

/** Podcast times with a place left for a resident (open, scheduled, not started). */
export function podcastChoices(times: PodcastTime[], now = new Date()): SlotChoice[] {
  return times
    .filter((x) => x.status === "scheduled" && x.open && x.starts_at > now && placesLeft(x, "resident") > 0)
    .map((x) => ({ value: x.id, label: label(x.time_date, x.start_time, x.place_he) }));
}

/** Podcast: the language, Hebrew already chosen. */
export const podcastExtras: ExtraRow[] = [
  {
    name: "language",
    title: s.language,
    defaultValue: "he",
    options: [
      ...LANGUAGES.filter((l) => ["he", "en", "ru"].includes(l.code)).map((l) => ({ value: l.code, label: l.he })),
      { value: "other", label: s.otherLanguage },
    ],
  },
];

/** Digital help: what help is needed (optional). */
export const helpExtras: ExtraRow[] = [{ name: "needs", title: s.needs, multi: true, options: opts(DIGITAL_NEEDS) }];

/** Events: how many people (1 chosen); language night also asks which languages (optional). */
export function eventExtras(event: CalendarEvent): ExtraRow[] {
  const rows: ExtraRow[] = [
    { name: "attendees", title: s.attendees, defaultValue: "1", options: s.attendeesOptions.map((l, i) => ({ value: String(i + 1), label: l })) },
  ];
  if (eventForm(event) === "language-night" || event.languages) {
    rows.push({ name: "languages", title: s.languages, multi: true, options: opts(LANGUAGES) });
  }
  return rows;
}
