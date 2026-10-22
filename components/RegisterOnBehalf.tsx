"use client";

import { useState } from "react";
import { registerOnBehalf } from "@/app/actions/admin";
import { ActionForm, MultiSelect, SelectField, TextField } from "@/components/forms";
import { Notice } from "@/components/ui";
import { LANGUAGES } from "@/config/languages";
import { ARRANGE_BY_MESSAGE, DIGITAL_NEEDS, PODCAST_TOPICS } from "@/config/options";

const TYPES = [
  { value: "event", label: "Event registration" },
  { value: "digital", label: "Digital support (book a slot)" },
  { value: "podcast", label: "Podcast sign-up" },
];

const opts = (list: readonly { code: string; en: string }[]) => list.map((o) => ({ value: o.code, label: o.en }));
const languages = opts(LANGUAGES);

/** Staff and leaders enter a resident's details for them (phone call, in person). */
export function RegisterOnBehalf({
  staff,
  events,
  slots,
  podcastTimes,
}: {
  staff: string;
  events: { key: string; label: string; form: string; languages: boolean }[];
  slots: { id: string; label: string; full: boolean }[];
  /** upcoming podcast times (staff may also choose a full or closed one) */
  podcastTimes: { id: string; label: string }[];
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
        {type === "digital" && (
          <SelectField
            name="slot"
            label="Slot"
            options={slots.map((s) => ({ value: s.id, label: s.full ? `${s.label} (full)` : s.label }))}
          />
        )}
        <TextField name="name" label="Resident's name" required />
        <TextField name="phone" label="Phone" type="tel" required />
        <TextField name="email" label="Email (optional)" type="email" />

        {type === "event" && (
          <>
            <SelectField name="attendees" label="Number of people" defaultValue="1" options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
            {(event?.form === "language-night" || event?.languages) && <MultiSelect name="languages" label="Languages they speak" options={languages} summary={(n) => (n ? `${n} selected` : "Choose…")} />}
            {event?.form === "game-night" && (
              <SelectField name="preferred_language" label="Play with someone who speaks…" defaultValue="none" options={[{ value: "none", label: "No preference" }, ...languages]} />
            )}
            <TextField name="notes" label="Notes" multiline />
          </>
        )}
        {type === "digital" && (
          <>
            <MultiSelect name="needs" label="Needs help with" options={opts(DIGITAL_NEEDS)} summary={(n) => (n ? `${n} selected` : "Choose…")} />
            <TextField name="needs_other" label="Other / details" />
          </>
        )}
        {type === "podcast" && (
          <>
            <MultiSelect name="topics" label="Topics" options={opts(PODCAST_TOPICS)} summary={(n) => (n ? `${n} selected` : "Choose…")} />
            <SelectField name="language" label="Preferred language" defaultValue="he" options={languages} />
            <SelectField
              name="time"
              label="Podcast time"
              defaultValue={podcastTimes[0]?.id ?? ARRANGE_BY_MESSAGE}
              options={[...podcastTimes.map((x) => ({ value: x.id, label: x.label })), { value: ARRANGE_BY_MESSAGE, label: "No time: arrange by message" }]}
            />
          </>
        )}
      </ActionForm>
    </>
  );
}
