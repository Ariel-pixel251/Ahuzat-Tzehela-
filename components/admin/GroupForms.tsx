"use client";

import { useState } from "react";
import { addVolunteerAdmin, pairPodcast } from "@/app/actions/admin";
import { ActionForm, Checkbox, TextField } from "@/components/forms";

const select = "mt-1 min-h-12 w-full rounded-lg border-2 border-ink bg-white px-3";

/** One side of a pair: someone on the list, or a new person typed in (no sign-up needed). */
function PersonPicker({ prefix, label, people }: { prefix: "a" | "b"; label: string; people: { id: string; label: string }[] }) {
  const [choice, setChoice] = useState("");
  return (
    <fieldset className="rounded-xl border-2 border-line p-4">
      <legend className="px-1 font-bold">{label}</legend>
      <label htmlFor={`${prefix}-pick`} className="block font-bold">Who</label>
      <select id={`${prefix}-pick`} name={prefix} required value={choice} onChange={(e) => setChoice(e.target.value)} className={select}>
        <option value="">Choose…</option>
        <option value="new">+ A new person (not signed up)</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      {choice === "new" && (
        <div className="mt-3 space-y-3">
          <TextField name={`${prefix}_name`} label="Name" required />
          <div>
            <label htmlFor={`${prefix}-portal`} className="block font-bold">They are a</label>
            <select id={`${prefix}-portal`} name={`${prefix}_portal`} defaultValue="student" className={select}>
              <option value="student">Student</option>
              <option value="resident">Resident</option>
            </select>
          </div>
          <TextField name={`${prefix}_email`} label="Email (optional, for the message)" type="email" />
          <TextField name={`${prefix}_phone`} label="Phone (optional)" type="tel" />
        </div>
      )}
    </fieldset>
  );
}

/** Admin: make a podcast pair from anyone, with an optional first meeting and a message to both. */
export function PairForm({ people }: { people: { id: string; label: string }[] }) {
  return (
    <ActionForm action={pairPodcast} submitLabel="Make the pair" pendingLabel="Saving…" className="max-w-3xl">
      <div className="grid gap-4 md:grid-cols-2">
        <PersonPicker prefix="a" label="Person 1" people={people} />
        <PersonPicker prefix="b" label="Person 2" people={people} />
      </div>
      <fieldset className="rounded-xl border-2 border-line p-4">
        <legend className="px-1 font-bold">First meeting (optional)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField name="meeting_date" label="Date" type="date" />
          <TextField name="meeting_time" label="Time" type="time" />
          <TextField name="meeting_place" label="Place" />
        </div>
      </fieldset>
      <Checkbox
        name="notify"
        defaultChecked
        label="Send them a message: who their partner is and when they meet (email if they have one; residents without email go to the messages-to-send list)"
      />
    </ActionForm>
  );
}

/** Admin: put a student into a slot, including one who hasn't signed up, optionally with a message. */
export function AddHelperForm({ slotId, students }: { slotId: string; students: { id: string; label: string }[] }) {
  const [choice, setChoice] = useState("");
  return (
    <ActionForm action={addVolunteerAdmin} submitLabel="Add helper" pendingLabel="Saving…" className="max-w-xl">
      <input type="hidden" name="slot" value={slotId} />
      <div>
        <label htmlFor={`student-${slotId}`} className="block font-bold">Student</label>
        <select id={`student-${slotId}`} name="student" required value={choice} onChange={(e) => setChoice(e.target.value)} className={select}>
          <option value="">Choose…</option>
          <option value="new">+ A student who hasn&apos;t signed up</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      {choice === "new" && (
        <>
          <TextField name="new_name" label="Student's name" required />
          <TextField name="new_email" label="Email (optional, for the message)" type="email" />
          <TextField name="new_phone" label="Phone (optional)" type="tel" />
        </>
      )}
      <Checkbox name="notify" defaultChecked label="Email the student when and where, and who is booked so far" />
    </ActionForm>
  );
}
