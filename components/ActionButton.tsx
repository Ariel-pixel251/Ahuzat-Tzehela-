"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/form";
import { buttonClass } from "./ui";

/** A one-button form calling a server action (cancel, release, mark done…), with its result. */
export function ActionButton({
  action,
  fields,
  label,
  pendingLabel,
  doneMessage,
  variant = "primary",
  className = "",
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  doneMessage?: string;
  variant?: keyof typeof buttonClass;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  if (state?.ok && (doneMessage || state.message)) {
    return (
      <p role="status" className="rounded-xl border-s-8 border-ok bg-ok-soft p-4 font-bold text-ok">
        {state.message ?? doneMessage}
      </p>
    );
  }
  return (
    <form action={formAction} className="inline">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" disabled={pending} className={`${buttonClass[variant]} ${className}`}>
        {pending && pendingLabel ? pendingLabel : label}
      </button>
      {state && !state.ok && state.message && (
        <p role="alert" className="mt-2 font-bold text-bad">
          {state.message}
        </p>
      )}
    </form>
  );
}
