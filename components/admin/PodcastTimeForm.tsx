"use client";

import { useState } from "react";
import { createPodcastTimeAction } from "@/app/actions/admin";
import { ActionForm, Checkbox, TextField } from "@/components/forms";

/** Create a podcast time, once or every week until a date. */
export function PodcastTimeForm() {
  const [repeat, setRepeat] = useState(false);
  return (
    <ActionForm action={createPodcastTimeAction} submitLabel="Create" pendingLabel="Saving…">
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField name="time_date" label="Date (first date)" type="date" required />
        <TextField name="start_time" label="From" type="time" defaultValue="16:00" required />
        <TextField name="end_time" label="Until" type="time" defaultValue="17:30" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="place_he" label="Place, as residents read it (Hebrew)" hint='e.g. "בספרייה"' required />
        <TextField name="place_en" label="Place (English, optional)" hint="e.g. Library" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="resident_places" label="Places for residents" type="number" min={1} max={50} defaultValue="1" required />
        <TextField name="student_places" label="Places for students" type="number" min={1} max={50} defaultValue="1" required />
      </div>
      <p className="text-sm">With 1 and 1, the resident and the student who choose it are paired automatically. With more, you pair them below.</p>
      <div onChange={(e) => setRepeat((e.target as HTMLInputElement).checked)}>
        <Checkbox name="repeat" label="Repeat every week (same weekday and time)" />
      </div>
      {repeat && <TextField name="until" label="Until (last date)" type="date" required />}
    </ActionForm>
  );
}
