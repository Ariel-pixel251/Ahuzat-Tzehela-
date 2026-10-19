import { LANGUAGES } from "@/config/languages";
import { DAYS, HOURS, DIGITAL_NEEDS, MEMORIAL_ROLES, PODCAST_TOPICS } from "@/config/options";
import type { WizardStep } from "@/components/Wizard";
import { eventForm, type CalendarEvent } from "@/lib/calendar/parse";
import { residentsText, sharedText } from "@/lib/i18n";

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
    fields: [{ kind: "multi", name: "hours", options: opts(HOURS), columns: 2, optional: true }],
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
  if (form === "memorial") {
    steps.push({ id: "role", title: f.memorialRole, fields: [{ kind: "choice", name: "role", options: opts(MEMORIAL_ROLES.resident) }] });
  }
  steps.push(contactStep());
  return steps;
}

export const helpSteps: WizardStep[] = [
  {
    id: "needs",
    title: f.needs,
    hint: f.needsHint,
    fields: [
      { kind: "multi", name: "needs", options: opts(DIGITAL_NEEDS) },
      { kind: "text", name: "needs_other", label: f.needsOther, optional: true },
    ],
  },
  ...whenSteps,
  languageStep(f.language),
  contactStep(),
];

export const podcastSteps: WizardStep[] = [
  { id: "topics", title: f.topics, hint: f.topicsHint, fields: [{ kind: "multi", name: "topics", options: opts(PODCAST_TOPICS) }] },
  languageStep(f.language),
  ...whenSteps,
  contactStep(),
];

export const lectureSteps: WizardStep[] = [
  { id: "topic", title: f.lectureTopic, fields: [{ kind: "text", name: "topic", label: f.lectureTopic, multiline: true }] },
  languageStep(f.lectureLanguage),
  {
    id: "date",
    title: f.lectureDate,
    fields: [{ kind: "text", name: "preferred_date", label: f.lectureDate, hint: f.lectureDateHint, optional: true }],
  },
  {
    id: "description",
    title: f.lectureDescription,
    fields: [{ kind: "text", name: "description", label: f.lectureDescription, multiline: true, optional: true }],
  },
  contactStep(),
];

export const callbackSteps: WizardStep[] = [contactStep({ email: false })];

export function lessonSteps(topics: { id: string; name_he: string }[]): WizardStep[] {
  return [
    {
      id: "topics",
      title: f.lessonTopics,
      fields: [
        { kind: "multi", name: "topics", options: topics.map((t) => ({ value: t.id, label: t.name_he })), optional: true },
        { kind: "text", name: "other_topic", label: f.lessonOther, optional: true },
      ],
    },
    contactStep(),
  ];
}
