"use client";

import { createContext, startTransition, useActionState, useContext, useId, useState, type ReactNode } from "react";
import { HONEYPOT, type ActionState } from "@/lib/form";
import { buttonClass } from "./ui";

// Regular one-page forms (student portal and admin). Errors come back from the server action
// and are shown next to each field.

const ErrorsContext = createContext<Record<string, string> | undefined>(undefined);
const useFieldError = (name: string) => useContext(ErrorsContext)?.[name];

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  success,
  className = "",
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  /** Replaces the form after success; omit to keep the form and show the message above it. */
  success?: (state: NonNullable<ActionState>) => ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  if (state?.ok && success) return <>{success(state)}</>;
  return (
    <ErrorsContext.Provider value={state?.ok ? undefined : state?.errors}>
      <form
        noValidate
        className={`space-y-5 ${className}`}
        onSubmit={(e) => {
          // submit through the action without React resetting the form, so nothing typed is lost
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => formAction(fd));
        }}
      >
        <div className="hp" aria-hidden="true">
          <label>
            Website
            <input name={HONEYPOT} tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        {children}
        <div aria-live="polite">
          {state && !state.ok && state.message && (
            <p role="alert" className="rounded-xl border-s-8 border-bad bg-bad-soft p-3 font-bold text-bad">
              {state.message}
            </p>
          )}
          {state?.ok && state.message && (
            <p role="status" className="rounded-xl border-s-8 border-ok bg-ok-soft p-3 font-bold text-ok">
              {state.message}
            </p>
          )}
        </div>
        <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full sm:w-auto`}>
          {pending && pendingLabel ? pendingLabel : submitLabel}
        </button>
      </form>
    </ErrorsContext.Provider>
  );
}

function FieldShell({ id, label, hint, error, children }: { id: string; label: ReactNode; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block font-bold">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 font-bold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass = "mt-1 min-h-12 w-full rounded-lg border-2 border-ink bg-white px-3 py-2";

function describedBy(id: string, hint?: string, error?: string) {
  return [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
}

export function TextField({
  name,
  label,
  hint,
  type = "text",
  required,
  defaultValue,
  autoComplete,
  multiline,
  min,
  max,
}: {
  name: string;
  label: string;
  hint?: string;
  type?: "text" | "email" | "tel" | "number" | "date" | "time";
  required?: boolean;
  defaultValue?: string;
  autoComplete?: string;
  multiline?: boolean;
  min?: number;
  max?: number;
}) {
  const id = useId() + name;
  const error = useFieldError(name);
  const props = {
    id,
    name,
    defaultValue,
    required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy(id, hint, error),
    className: inputClass,
  };
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      {multiline ? <textarea {...props} rows={3} /> : <input {...props} type={type} autoComplete={autoComplete} min={min} max={max} />}
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  options,
  defaultValue,
  hint,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  hint?: string;
}) {
  const id = useId() + name;
  const error = useFieldError(name);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={inputClass}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/**
 * Multi-select dropdown: a disclosure button opening a list of checkboxes. Works with keyboard
 * and screen readers (native checkboxes), and submits like a multi-value field.
 */
export function MultiSelect({
  name,
  label,
  options,
  hint,
  summary,
  defaultValue = [],
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  hint?: string;
  summary: (count: number) => string;
  defaultValue?: string[];
}) {
  const id = useId() + name;
  const error = useFieldError(name);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const chosen = options.filter((o) => selected.includes(o.value)).map((o) => o.label);
  return (
    <div>
      <p id={`${id}-label`} className="font-bold">
        {label}
      </p>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-describedby={describedBy(id, hint, error)}
        onClick={() => setOpen(!open)}
        className={`${inputClass} flex items-center justify-between text-start`}
      >
        <span>
          <span className="sr-only">{label}: </span>
          {chosen.length ? chosen.join(", ") : summary(0)}
        </span>
        <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {/* the checkboxes stay in the form while the list is closed, so they still submit */}
      <fieldset
        id={`${id}-list`}
        hidden={!open}
        aria-labelledby={`${id}-label`}
        className="mt-1 grid max-h-72 grid-cols-1 gap-1 overflow-y-auto rounded-lg border-2 border-ink p-2 sm:grid-cols-2"
      >
        {options.map((o) => (
          <label key={o.value} className="flex min-h-11 items-center gap-3 rounded px-2 hover:bg-sand">
            <input
              type="checkbox"
              name={name}
              value={o.value}
              checked={selected.includes(o.value)}
              onChange={(e) => setSelected((s) => (e.target.checked ? [...s, o.value] : s.filter((x) => x !== o.value)))}
              className="size-5"
            />
            {o.label}
          </label>
        ))}
      </fieldset>
      {error && (
        <p id={`${id}-error`} className="mt-1 font-bold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

export function Checkbox({ name, label, required }: { name: string; label: ReactNode; required?: boolean }) {
  const id = useId() + name;
  const error = useFieldError(name);
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          name={name}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-1 size-6 shrink-0"
        />
        <label htmlFor={id}>{label}</label>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 font-bold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

/** A compact form for admin rows (a select plus a button), showing the action's result inline. */
export function InlineForm({
  action,
  children,
  submitLabel,
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      {children}
      <button type="submit" disabled={pending} className={buttonClass.small}>
        {submitLabel}
      </button>
      {state?.message && (
        <span role={state.ok ? "status" : "alert"} className={`text-sm font-bold ${state.ok ? "text-ok" : "text-bad"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}
