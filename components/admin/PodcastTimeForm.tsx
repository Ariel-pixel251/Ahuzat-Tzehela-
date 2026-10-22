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
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField name="place_he" label="Place, as residents read it (Hebrew)" hint='e.g. "בספרייה"' required />
        <TextField name="place_en" label="Place (English, optional)" hint="e.g. Library" />
        <TextField name="pairs" label="Pairs" hint="How many residents and how many students can choose it" type="number" min={1} max={50} defaultValue="2" required />
      </div>
      <div onChange={(e) => setRepeat((e.target as HTMLInputElement).checked)}>
        <Checkbox name="repeat" label="Repeat every week (same weekday and time)" />
      </div>
      {repeat && <TextField name="until" label="Until (last date)" type="date" required />}
    </ActionForm>
  );
}
