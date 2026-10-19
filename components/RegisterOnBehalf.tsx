"use client";

import { useState } from "react";
import { registerOnBehalf } from "@/app/actions/admin";
import { ActionForm, MultiSelect, SelectField, TextField } from "@/components/forms";
import { Notice } from "@/components/ui";
import { LANGUAGES } from "@/config/languages";
import { DAYS, HOURS, DIGITAL_NEEDS, MEMORIAL_ROLES, PODCAST_TOPICS } from "@/config/options";

const TYPES = [
  { value: "event", label: "Event registration" },
  { value: "digital", label: "Digital support request" },
  { value: "podcast", label: "Podcast sign-up" },
  { value: "lesson", label: "Private lesson (wants to learn)" },
  { value: "lecture", label: "Lecture proposal" },
  { value: "callback", label: "Call-back request" },
];

const opts = (list: readonly { code: string; en: string }[]) => list.map((o) => ({ value: o.code, label: o.en }));
const languages = opts(LANGUAGES);

/** Staff and leaders enter a resident's details for them (phone call, paper sheet, in person). */
export function RegisterOnBehalf({
  staff,
  events,
  topics,
}: {
  staff: string;
  events: { key: string; label: string; form: string; languages: boolean }[];
  topics: { id: string; name_en: string }[];
}) {
  const [type, setType] = useState("event");
  const [eventKey, setEventKey] = useState(events[0]?.key ?? "");
  const event = events.find((e) => e.key === eventKey);
  return (
    <>
      <div className="mb-6 max-w-md">
        <label htmlFor="type" className="block font-bold">What are you registering?</label>
        <select id="type" value={type} onChange={(e) => setType(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border-2 border-ink px-3">
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <ActionForm
        key={type}
        action={registerOnBehalf}
        submitLabel="Save registration"
        pendingLabel="Saving…"
        success={(s) => (
          <Notice kind="ok">
            <p className="font-bold">{s.message}</p>
            <p>Tell the resident their request code. Reload the page to register someone else.</p>
          </Notice>
        )}
        className="max-w-xl"
      >
        <input type="hidden" name="type" value={type} />
        <TextField name="staff" label="Your name (registered by)" defaultValue={staff} required />
        {type === "event" && (
          <div>
            <label htmlFor="event" className="block font-bold">Event</label>
            <select id="event" name="event" value={eventKey} onChange={(e) => setEventKey(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border-2 border-ink px-3">
              {events.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
            </select>
          </div>
        )}
        <TextField name="name" label="Resident's name" required />
        <TextField name="phone" label="Phone" type="tel" required />
        {type !== "callback" && <TextField name="email" label="Email (optional)" type="email" />}

        {type === "event" && (
          <>
            <SelectField name="attendees" label="Number of people" defaultValue="1" options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
            {(event?.form === "language-night" || event?.languages) && <MultiSelect name="languages" label="Languages they speak" options={languages} summary={(n) => (n ? `${n} selected` : "Choose…")} />}
            {event?.form === "game-night" && (
              <SelectField name="preferred_language" label="Play with someone who speaks…" defaultValue="none" options={[{ value: "none", label: "No preference" }, ...languages]} />
            )}
            {event?.form === "memorial" && <SelectField name="role" label="Role" options={opts(MEMORIAL_ROLES.resident)} />}
            <TextField name="notes" label="Notes" multiline />
          </>
        )}
        {type === "digital" && (
          <>
            <MultiSelect name="needs" label="Needs help with" options={opts(DIGITAL_NEEDS)} summary={(n) => (n ? `${n} selected` : "Choose…")} />
            <TextField name="needs_other" label="Other / details" />
            <MultiSelect name="days" label="Days" options={opts(DAYS)} summary={(n) => (n ? `${n} selected` : "Any")} />
            <MultiSelect name="hours" label="Hours" options={opts(HOURS)} summary={(n) => (n ? `${n} selected` : "Any")} />
            <SelectField name="language" label="Language" defaultValue="he" options={languages} />
          </>
        )}
        {type === "podcast" && (
          <>
            <MultiSelect name="topics" label="Topics" options={opts(PODCAST_TOPICS)} summary={(n) => (n ? `${n} selected` : "Choose…")} />
            <SelectField name="language" label="Preferred language" defaultValue="he" options={languages} />
            <TextField name="availability" label="Availability" />
          </>
        )}
        {type === "lesson" && (
          <>
            <MultiSelect name="topics" label="Wants to learn" options={topics.map((t) => ({ value: t.id, label: t.name_en }))} summary={(n) => (n ? `${n} selected` : "Choose…")} />
            <TextField name="other_topic" label="Something else" />
            <TextField name="notes" label="Notes" multiline />
          </>
        )}
        {type === "lecture" && (
          <>
            <TextField name="topic" label="Lecture topic" required />
            <SelectField name="language" label="Language" defaultValue="he" options={languages} />
            <TextField name="preferred_date" label="Preferred date" />
            <TextField name="description" label="Description" multiline />
          </>
        )}
      </ActionForm>
    </>
  );
}
