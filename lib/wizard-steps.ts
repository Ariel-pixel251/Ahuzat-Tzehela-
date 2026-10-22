import { LANGUAGES } from "@/config/languages";
import { ARRANGE_BY_MESSAGE, DIGITAL_NEEDS, PODCAST_TOPICS } from "@/config/options";
import type { WizardStep } from "@/components/Wizard";
import { eventForm, type CalendarEvent } from "@/lib/calendar/parse";
import { placesLeft, type PodcastTime } from "@/lib/db/podcast";
import { freePlaces, type Slot } from "@/lib/db/slots";
import { residentsText, sharedText } from "@/lib/i18n";
import { formatPodcastTime, formatSlot } from "@/lib/i18n/format";

// The questions of each resident wizard, in order. One question per screen.

const f = residentsText.fields;
const opts = (list: readonly { code: string; he: string }[]) => list.map((o) => ({ value: o.code, label: o.he }));
const languageOptions = opts(LANGUAGES);

export function contactStep({ email = true } = {}): WizardStep {
  return {
    id: "contact",
    title: f.contactTitle,
    reviewLabel: f.contactTitle,
    fields: [
      { kind: "text", name: "name", label: f.nameLabel, check: "name", autoComplete: "name" },
      { kind: "text", name: "phone", label: f.phoneLabel, hint: f.phoneHint, type: "tel", check: "phone", autoComplete: "tel" },
      ...(email
        ? [{ kind: "text" as const, name: "email", label: f.email, hint: f.emailHint, type: "email" as const, check: "email" as const, optional: true, autoComplete: "email" }]
        : []),
    ],
  };
}

const languageStep = (title: string, name = "language"): WizardStep => ({
  id: name,
  title,
  fields: [{ kind: "choice", name, options: languageOptions, defaultValue: "he", columns: 2 }],
});

export function eventSteps(event: CalendarEvent): WizardStep[] {
  const form = eventForm(event);
  const steps: WizardStep[] = [
    {
      id: "attendees",
      title: f.attendees,
      fields: [
        {
          kind: "choice",
          name: "attendees",
          defaultValue: "1",
          options: f.attendeesOptions.map((label, i) => ({ value: String(i + 1), label })),
        },
      ],
    },
  ];
  if (form === "language-night" || event.languages) {
    steps.push({
      id: "languages",
      title: f.languages,
      hint: f.languagesHint,
      fields: [
        { kind: "multi", name: "languages", options: languageOptions, columns: 2 },
        { kind: "text", name: "other_language", label: sharedText.he.otherLanguageLabel, optional: true },
      ],
    });
  }
  if (form === "game-night") {
    steps.push({
      id: "preferred_language",
      title: f.playLanguage,
      fields: [
        {
          kind: "choice",
          name: "preferred_language",
          defaultValue: "none",
          columns: 2,
          options: [{ value: "none", label: sharedText.he.noPreference }, ...languageOptions.filter((o) => o.value !== "other")],
        },
      ],
    });
  }
  steps.push(contactStep());
  return steps;
}

/** The open slots as big buttons: time and place, with places left; full ones can't be chosen. */
export function slotOptions(slots: Slot[], now = new Date()) {
  return slots
    .filter((s) => s.status === "scheduled" && s.booking_open && s.closes_at > now)
    .map((s) => {
      const free = freePlaces(s);
      return { value: s.id, label: formatSlot(s, "he"), detail: free ? f.placesLeft(free) : f.slotFull, disabled: free === 0 };
    });
}

/** Book digital support: a time, what help is needed, then name and phone. */
export function helpSteps(slots: Slot[]): WizardStep[] {
  return [
    { id: "slot", title: f.slot, hint: f.slotHint, fields: [{ kind: "choice", name: "slot", options: slotOptions(slots) }] },
    {
      id: "needs",
      title: f.needs,
      hint: f.needsHint,
      fields: [
        { kind: "multi", name: "needs", options: opts(DIGITAL_NEEDS), columns: 2 },
        { kind: "text", name: "needs_other", label: f.needsOther, optional: true },
      ],
    },
    contactStep(),
  ];
}

/** The team's podcast times as big buttons (full ones can't be chosen), then "send me a message". */
export function podcastTimeOptions(times: PodcastTime[], now = new Date()) {
  return [
    ...times
      .filter((t) => t.open && t.starts_at > now)
      .map((t) => {
        const free = placesLeft(t, "resident");
        return {
          value: t.id,
          label: formatPodcastTime(t, "he"),
          detail: free ? f.placesLeft(free) : f.slotFull,
          disabled: free === 0,
        };
      }),
    { value: ARRANGE_BY_MESSAGE, label: f.arrangeByMessage },
  ];
}

/** Join the podcast: topics, language, one of the team's times, then name and phone. */
export function podcastSteps(times: PodcastTime[]): WizardStep[] {
  return [
    { id: "topics", title: f.topics, hint: f.topicsHint, fields: [{ kind: "multi", name: "topics", options: opts(PODCAST_TOPICS) }] },
    languageStep(f.language),
    { id: "time", title: f.podcastTime, hint: f.slotHint, fields: [{ kind: "choice", name: "time", options: podcastTimeOptions(times) }] },
    contactStep(),
  ];
}

export const reportSteps: WizardStep[] = [
  { id: "message", title: f.reportMessage, fields: [{ kind: "text", name: "message", label: f.reportMessageLabel, multiline: true }] },
  {
    id: "contact",
    title: f.reportContactTitle,
    reviewLabel: f.reportContactTitle,
    fields: [
      { kind: "text", name: "name", label: f.nameLabel, optional: true, autoComplete: "name" },
      { kind: "text", name: "phone", label: f.phoneLabel, type: "tel", check: "phone", optional: true, autoComplete: "tel" },
    ],
  },
];
