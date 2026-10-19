"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { residentsText as t, sharedText } from "@/lib/i18n";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { HONEYPOT, type ActionState } from "@/lib/form";
import { CheckIcon } from "./icons";
import { buttonClass } from "./ui";

// Resident forms: one question per screen, big choice buttons, a review screen, then a calm
// confirmation with the request code. Nothing times out, nothing is cleared.

export type WizardOption = { value: string; label: string };

export type WizardField =
  | { kind: "choice"; name: string; options: WizardOption[]; label?: string; optional?: boolean; defaultValue?: string; columns?: 1 | 2 }
  | {
      kind: "multi";
      name: string;
      options: WizardOption[];
      label?: string;
      hint?: string;
      optional?: boolean;
      columns?: 1 | 2;
      defaultValue?: string[];
    }
  | {
      kind: "text";
      name: string;
      label: string;
      hint?: string;
      type?: "text" | "tel" | "email";
      multiline?: boolean;
      optional?: boolean;
      check?: "name" | "phone" | "email";
      autoComplete?: string;
    };

export type WizardStep = { id: string; title: string; hint?: string; fields: WizardField[]; reviewLabel?: string };

type Values = Record<string, string | string[]>;

const he = sharedText.he.errors;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_MESSAGES = { empty: he.phoneEmpty, short: he.phoneShort, long: he.phoneLong, invalid: he.phoneInvalid };

function initialValues(steps: WizardStep[]): Values {
  const v: Values = {};
  for (const s of steps)
    for (const f of s.fields) {
      if (f.kind === "multi") v[f.name] = f.defaultValue ?? [];
      else if (f.kind === "choice") v[f.name] = f.defaultValue ?? "";
      else v[f.name] = "";
    }
  return v;
}

function validateStep(step: WizardStep, values: Values): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of step.fields) {
    const value = values[f.name];
    if (f.kind === "choice" && !f.optional && !value) errors[f.name] = he.choose;
    if (f.kind === "multi" && !f.optional && !(value as string[]).length) errors[f.name] = he.choose;
    if (f.kind === "text") {
      const s = String(value ?? "").trim();
      if (!s) {
        if (!f.optional) errors[f.name] = f.check === "name" ? he.name : f.check === "phone" ? he.phoneEmpty : he.text;
        continue;
      }
      if (f.check === "phone") {
        const r = normalizePhone(s);
        if (!r.ok) errors[f.name] = PHONE_MESSAGES[r.reason];
      }
      if (f.check === "email" && !EMAIL.test(s)) errors[f.name] = he.emailInvalid;
    }
  }
  return errors;
}

/** A field's answer for the review screen; phone numbers and emails are shown left to right. */
function display(field: WizardField, values: Values): { text: string; ltr: boolean } {
  const value = values[field.name];
  if (field.kind === "choice") return { text: field.options.find((o) => o.value === value)?.label ?? "", ltr: false };
  if (field.kind === "multi") {
    return { text: field.options.filter((o) => (value as string[]).includes(o.value)).map((o) => o.label).join(", "), ltr: false };
  }
  const text = String(value ?? "").trim();
  if (field.check === "phone") {
    const r = normalizePhone(text);
    return { text: r.ok ? formatPhone(r.value) : text, ltr: true };
  }
  return { text, ltr: field.type === "email" };
}

export function Wizard({
  steps,
  action,
  hidden = {},
  done,
  doneWaitlist,
  privacyHref = "/residents/privacy",
}: {
  steps: WizardStep[];
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  hidden?: Record<string, string>;
  done: string;
  doneWaitlist?: string;
  privacyHref?: string;
}) {
  const [values, setValues] = useState<Values>(() => initialValues(steps));
  const [index, setIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, formAction, pending] = useActionState(action, null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);

  const reviewIndex = steps.length;
  const total = steps.length + 1;
  const finished = state?.ok === true;

  // move focus to the new question so screen readers read it
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [index, finished]);

  // server-side errors: go back to the first question that needs fixing (once per answer)
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state && !state.ok && state.errors) {
      setErrors(state.errors);
      const i = steps.findIndex((s) => s.fields.some((f) => state.errors?.[f.name]));
      if (i >= 0) setIndex(i);
    }
  }

  const set = (name: string, value: string | string[]) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => ({ ...e, [name]: "" }));
  };

  function next() {
    const errs = validateStep(steps[index], values);
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setIndex((i) => i + 1);
  }

  function submit() {
    const fd = new FormData();
    for (const [k, v] of Object.entries(hidden)) fd.append(k, v);
    for (const [k, v] of Object.entries(values)) {
      if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
      else fd.append(k, v);
    }
    fd.append(HONEYPOT, honeypotRef.current?.value ?? "");
    startTransition(() => formAction(fd));
  }

  if (finished) {
    return (
      <section aria-labelledby="wizard-done" className="rounded-2xl border-4 border-ok bg-ok-soft p-6 text-center">
        <CheckIcon className="mx-auto size-16 text-ok" />
        <h2 id="wizard-done" ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-extrabold text-ok">
          {t.wizard.thanks}
        </h2>
        <p className="mt-3 text-xl">{state.waitlist && doneWaitlist ? doneWaitlist : done}</p>
        {state.code && (
          <div className="mx-auto mt-6 max-w-sm rounded-xl border-2 border-ink bg-white p-4">
            <p>{t.wizard.codeLabel}</p>
            <p className="text-5xl font-extrabold tracking-widest" dir="ltr">
              {state.code}
            </p>
            <p className="mt-2 text-base">{t.wizard.codeHint}</p>
          </div>
        )}
        {state.message && <p className="mt-4">{state.message}</p>}
        <Link href="/residents" className={`${buttonClass.primary} mt-6 w-full min-h-[72px] text-xl`}>
          {t.backHome}
        </Link>
      </section>
    );
  }

  const onReview = index === reviewIndex;
  const step = steps[index];

  return (
    <section aria-labelledby="wizard-heading">
      <div className="hp" aria-hidden="true">
        <label>
          {HONEYPOT}
          <input ref={honeypotRef} name={HONEYPOT} tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <p className="text-lg font-bold">{t.wizard.step(index + 1, total)}</p>
      <div className="mt-2 h-3 w-full rounded-full border-2 border-ink" aria-hidden="true">
        <div className="h-full rounded-full bg-brand" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>

      {onReview ? (
        <div className="mt-6">
          <h2 id="wizard-heading" ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold">
            {t.wizard.reviewTitle}
          </h2>
          <dl className="mt-4 space-y-3">
            {steps.map((s, i) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-line p-4">
                <div>
                  <dt className="font-bold">{s.reviewLabel ?? s.title}</dt>
                  <dd className="text-xl">
                    {s.fields.map((f) => display(f, values)).filter((a) => a.text).length === 0
                      ? t.wizard.emptyAnswer
                      : s.fields
                          .map((f) => ({ name: f.name, ...display(f, values) }))
                          .filter((a) => a.text)
                          .map((a) => (
                            <span key={a.name} className="block">
                              {a.ltr ? <bdi dir="ltr">{a.text}</bdi> : a.text}
                            </span>
                          ))}
                  </dd>
                </div>
                <button type="button" className={buttonClass.secondary} onClick={() => setIndex(i)}>
                  {t.wizard.fix}
                  <span className="sr-only">: {s.reviewLabel ?? s.title}</span>
                </button>
              </div>
            ))}
          </dl>
          <p className="mt-6">
            {t.wizard.privacy}{" "}
            <Link href={privacyHref} className="font-bold underline">
              {t.wizard.privacyLink}
            </Link>
          </p>
          {state && !state.ok && state.message && (
            <p role="alert" className="mt-4 rounded-xl border-s-8 border-bad bg-bad-soft p-4 font-bold text-bad">
              {state.message}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className={`${buttonClass.primary} mt-6 w-full min-h-[72px] text-2xl`}
          >
            {pending ? t.wizard.sending : t.wizard.send}
          </button>
          <button type="button" onClick={() => setIndex(index - 1)} className={`${buttonClass.secondary} mt-3 w-full`}>
            {t.wizard.back}
          </button>
        </div>
      ) : (
        <form
          className="mt-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
        >
          <h2 id="wizard-heading" ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold leading-snug">
            {step.title}
          </h2>
          {step.hint && <p className="mt-2">{step.hint}</p>}
          <div className="mt-5 space-y-6">
            {step.fields.map((f) => (
              <FieldView key={f.name} field={f} value={values[f.name]} error={errors[f.name]} onChange={(v) => set(f.name, v)} labelledBy="wizard-heading" />
            ))}
          </div>
          <button type="submit" className={`${buttonClass.primary} mt-8 w-full min-h-[72px] text-2xl`}>
            {t.wizard.next}
          </button>
          {index > 0 && (
            <button type="button" onClick={() => setIndex(index - 1)} className={`${buttonClass.secondary} mt-3 w-full`}>
              {t.wizard.back}
            </button>
          )}
        </form>
      )}
    </section>
  );
}

function FieldView({
  field,
  value,
  error,
  onChange,
  labelledBy,
}: {
  field: WizardField;
  value: string | string[];
  error?: string;
  onChange: (v: string | string[]) => void;
  labelledBy: string;
}) {
  const errorId = `${field.name}-error`;
  const errorText = error ? (
    <p id={errorId} className="mt-2 rounded-lg bg-bad-soft p-3 font-bold text-bad">
      {error}
    </p>
  ) : null;

  if (field.kind === "text") {
    const common = {
      id: field.name,
      name: field.name,
      value: String(value),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
      "aria-invalid": error ? true : undefined,
      "aria-describedby": [field.hint ? `${field.name}-hint` : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined,
      className: "mt-2 w-full rounded-xl border-2 border-ink bg-white px-4 py-3 text-xl",
    };
    return (
      <div>
        <label htmlFor={field.name} className="block font-bold">
          {field.label}
        </label>
        {field.hint && (
          <p id={`${field.name}-hint`} className="text-muted">
            {field.hint}
          </p>
        )}
        {field.multiline ? (
          <textarea {...common} rows={4} />
        ) : (
          <input
            {...common}
            type={field.type ?? "text"}
            inputMode={field.type === "tel" ? "tel" : field.type === "email" ? "email" : undefined}
            autoComplete={field.autoComplete}
            dir={field.type === "tel" || field.type === "email" ? "ltr" : undefined}
            className={`${common.className} min-h-14 ${field.type === "tel" || field.type === "email" ? "text-end" : ""}`}
          />
        )}
        {errorText}
      </div>
    );
  }

  const multi = field.kind === "multi";
  const selected = multi ? (value as string[]) : [value as string];
  const toggle = (v: string) => {
    if (!multi) return onChange(v);
    const list = value as string[];
    onChange(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };
  const groupLabelId = field.label ? `${field.name}-label` : labelledBy;

  return (
    <div>
      {field.label && (
        <p id={`${field.name}-label`} className="mb-2 text-2xl font-bold">
          {field.label}
        </p>
      )}
      {field.kind === "multi" && field.hint && <p className="mb-2">{field.hint}</p>}
      <div
        role={multi ? "group" : "radiogroup"}
        aria-labelledby={groupLabelId}
        aria-describedby={error ? errorId : undefined}
        className={`grid gap-3 ${field.columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {field.options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              role={multi ? undefined : "radio"}
              aria-checked={multi ? undefined : on}
              aria-pressed={multi ? on : undefined}
              onClick={() => toggle(o.value)}
              className={`flex min-h-16 items-center justify-between gap-3 rounded-xl border-4 px-5 py-3 text-start text-xl font-bold ${
                on ? "border-brand bg-brand text-white" : "border-ink bg-white text-ink hover:bg-sand"
              }`}
            >
              <span>{o.label}</span>
              {on && <CheckIcon className="size-6" />}
            </button>
          );
        })}
      </div>
      {errorText}
    </div>
  );
}
