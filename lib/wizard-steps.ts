import { LANGUAGES } from "@/config/languages";
import { DAYS, DIGITAL_NEEDS, PODCAST_TOPICS } from "@/config/options";
import type { WizardStep } from "@/components/Wizard";
import { eventForm, type CalendarEvent } from "@/lib/calendar/parse";
import { freePlaces, type Slot } from "@/lib/db/slots";
import { residentsText, sharedText } from "@/lib/i18n";
import { formatSlot } from "@/lib/i18n/format";

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

// one question per screen: first the days, then the hours
const whenSteps: WizardStep[] = [
  { id: "days", title: f.days, fields: [{ kind: "multi", name: "days", options: opts(DAYS), columns: 2, optional: true }] },
  {
    id: "hours",
    title: f.hours,
    hint: f.hoursHint,
    fields: [{ kind: "timerange", name: "hours" }],
  },
];

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

export const podcastSteps: WizardStep[] = [
  { id: "topics", title: f.topics, hint: f.topicsHint, fields: [{ kind: "multi", name: "topics", options: opts(PODCAST_TOPICS) }] },
  languageStep(f.language),
  ...whenSteps,
  contactStep(),
];

export const callbackSteps: WizardStep[] = [contactStep({ email: false })];

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
