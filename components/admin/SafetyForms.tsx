"use client";

import { blockContactAction, deletePersonAction } from "@/app/actions/admin";
import { ActionForm, Checkbox, TextField } from "@/components/forms";

export function BlockForm() {
  return (
    <ActionForm action={blockContactAction} submitLabel="Block" pendingLabel="Saving…" className="max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="phone" label="Phone" type="tel" />
        <TextField name="email" label="Email" type="email" />
      </div>
      <TextField name="reason" label="Reason (only admins see it)" />
    </ActionForm>
  );
}

export function DeletePersonForm() {
  return (
    <ActionForm action={deletePersonAction} submitLabel="Delete all data for this person" pendingLabel="Deleting…" className="max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="phone" label="Phone" type="tel" />
        <TextField name="email" label="Email" type="email" />
      </div>
      <Checkbox
        name="confirm"
        required
        label="I understand this deletes every registration, booking, podcast sign-up, message, student account and report with this phone or email, and can't be undone."
      />
    </ActionForm>
  );
}
