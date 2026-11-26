"use client";

import { useState } from "react";
import { registerOnBehalf } from "@/app/actions/admin";
import { ActionForm, MultiSelect, SelectField, TextField } from "@/components/forms";
import { Notice } from "@/components/ui";
import { LANGUAGES } from "@/config/languages";
import { DIGITAL_NEEDS } from "@/config/options";

const TYPES = [
  { value: "event", label: "Event registration" },
  { value: "digital", label: "Digital support (book a slot)" },
  { value: "podcast", label: "Podcast time" },
];

const opts = (list: readonly { code: string; en: string }[]) => list.map((o) => ({ value: o.code, label: o.en }));
const languages = opts(LANGUAGES);

/**
 * Staff and leaders enter a resident's details for them (phone call, in person): the same fields as
 * the resident's own two screens (the slot, name, phone and the one extra question).
 */
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
            <p>Tell the resident their request code (they need it only to cancel). Reload the page to register someone else.</p>
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
          <SelectField name="slot" label="Slot" options={slots.map((s) => ({ value: s.id, label: s.full ? `${s.label} (full)` : s.label }))} />
        )}
        {type === "podcast" && <SelectField name="time" label="Podcast time" options={podcastTimes.map((x) => ({ value: x.id, label: x.label }))} />}
        <TextField name="name" label="Resident's name" required />
        <TextField name="phone" label="Phone" type="tel" required />

        {type === "event" && (
          <>
            <SelectField name="attendees" label="Number of people" defaultValue="1" options={[{ value: "1", label: "1" }, { value: "2", label: "2" }]} />
            {(event?.form === "language-night" || event?.languages) && (
              <MultiSelect name="languages" label="Languages they speak (optional)" options={languages} summary={(n) => (n ? `${n} selected` : "Choose…")} />
            )}
          </>
        )}
        {type === "digital" && (
          <MultiSelect name="needs" label="Needs help with (optional)" options={opts(DIGITAL_NEEDS)} summary={(n) => (n ? `${n} selected` : "Choose…")} />
        )}
        {type === "podcast" && (
          <SelectField
            name="language"
            label="Language"
            defaultValue="he"
            options={[...languages.filter((l) => ["he", "en", "ru"].includes(l.value)), { value: "other", label: "Another language" }]}
          />
        )}
      </ActionForm>
    </>
  );
}
