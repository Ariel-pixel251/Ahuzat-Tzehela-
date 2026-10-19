"use client";

import { useActionState, type ReactNode } from "react";
import { submitSignup, type FormState } from "@/app/actions";

type Props = {
  kind: "project" | "event" | "lesson" | "lecture";
  children?: ReactNode;
  notesLabel?: string;
  submitLabel?: string;
};

export default function SignupForm({ kind, children, notesLabel = "הערות (לא חובה)", submitLabel = "שליחה" }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitSignup, null);

  if (state?.ok) {
    return (
      <p className="notice success" role="status">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="form">
      <input type="hidden" name="kind" value={kind} />
      {children}

      <label>
        שם מלא
        <input name="full_name" required autoComplete="name" maxLength={100} />
      </label>
      <label>
        מייל
        <input name="email" type="email" required autoComplete="email" dir="ltr" maxLength={200} />
      </label>
      <label>
        טלפון (לא חובה)
        <input name="phone" type="tel" autoComplete="tel" dir="ltr" maxLength={30} />
      </label>
      <label>
        {notesLabel}
        <textarea name="notes" rows={3} maxLength={1000} />
      </label>

      <label className="hp" aria-hidden="true">
        אתר
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      {state && !state.ok && (
        <p className="notice error" role="alert">
          {state.message}
        </p>
      )}

      <button type="submit" disabled={pending}>
        {pending ? "שולח…" : submitLabel}
      </button>
    </form>
  );
}
