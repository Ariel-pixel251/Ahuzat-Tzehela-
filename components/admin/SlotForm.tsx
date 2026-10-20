"use client";

import { useState } from "react";
import { createSlotAction, updateSlotAction } from "@/app/actions/admin";
import { ActionForm, Checkbox, TextField } from "@/components/forms";

export type SlotDefaults = {
  id?: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  place_he: string;
  place_en: string;
  resident_places: string;
  helpers_needed: string;
  note_en: string;
  note_he: string;
  booking_open: boolean;
  closes_hours_before: string;
};

export const EMPTY_SLOT: SlotDefaults = {
  slot_date: "",
  start_time: "16:00",
  end_time: "17:30",
  place_he: "",
  place_en: "",
  resident_places: "4",
  helpers_needed: "2",
  note_en: "",
  note_he: "",
  booking_open: true,
  closes_hours_before: "24",
};

/** Create a slot (once, or every week until a date), or edit one slot when `defaults.id` is set. */
export function SlotForm({ defaults = EMPTY_SLOT }: { defaults?: SlotDefaults }) {
  const editing = Boolean(defaults.id);
  const [repeat, setRepeat] = useState(false);
  return (
    <ActionForm action={editing ? updateSlotAction : createSlotAction} submitLabel={editing ? "Save changes" : "Create"} pendingLabel="Saving…">
      {editing && <input type="hidden" name="id" value={defaults.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField name="slot_date" label={editing ? "Date" : "Date (first date)"} type="date" defaultValue={defaults.slot_date} required />
        <TextField name="start_time" label="Start" type="time" defaultValue={defaults.start_time} required />
        <TextField name="end_time" label="End" type="time" defaultValue={defaults.end_time} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="place_he" label="Place, as residents read it (Hebrew)" hint='e.g. "בחדר הקהילה"' defaultValue={defaults.place_he} required />
        <TextField name="place_en" label="Place (English, optional)" hint="e.g. Community room" defaultValue={defaults.place_en} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField name="resident_places" label="Resident places" type="number" min={1} max={50} defaultValue={defaults.resident_places} required />
        <TextField name="helpers_needed" label="Student helpers needed" type="number" min={0} max={20} defaultValue={defaults.helpers_needed} required />
        <TextField
          name="closes_hours_before"
          label="Booking closes (hours before)"
          hint="Empty: open until it starts"
          type="number"
          min={0}
          max={336}
          defaultValue={defaults.closes_hours_before}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="note_en" label="Note for students (optional)" defaultValue={defaults.note_en} />
        <TextField name="note_he" label="Note in Hebrew (optional)" defaultValue={defaults.note_he} />
      </div>
      <Checkbox name="booking_open" label="Open for booking" defaultChecked={defaults.booking_open} />
      {!editing && (
        <div onChange={(e) => setRepeat((e.target as HTMLInputElement).checked)}>
          <Checkbox name="repeat" label="Repeat every week (same weekday and time)" />
        </div>
      )}
      {!editing && repeat && <TextField name="until" label="Until (last date)" type="date" required />}
    </ActionForm>
  );
}
