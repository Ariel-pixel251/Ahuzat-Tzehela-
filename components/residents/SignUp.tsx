"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { HONEYPOT, type ActionState } from "@/lib/form";
import { residentsText as t, sharedText } from "@/lib/i18n";
import { normalizePhone } from "@/lib/phone";
import { CheckIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui";

// Every resident sign-up (podcast, digital help, events) uses the same two screens, so it is
// learned once:
//   1. "מתי נוח לך?": one big button per open slot (full and past slots are not shown at all).
//      Events skip it: the event they tapped is the time.
//   2. "איך קוראים לך ומה מספר הטלפון?": the chosen slot in a box with "לשנות", name and phone,
//      at most one extra row of big buttons with the usual answer already chosen, and "להירשם".
// Then a calm "נרשמת! ✓" with when and where, the code, and a button to cancel right away.
// No dropdowns, no email, nothing expires, nothing typed is ever cleared.

const s = t.signup;
const he = sharedText.he.errors;
const PHONE_MESSAGES = { empty: he.phoneEmpty, short: he.phoneShort, long: he.phoneLong, invalid: he.phoneInvalid };

export type SlotChoice = { value: string; label: string };

/** An extra question as a row of big buttons. `multi`: any number (nothing chosen is fine). */
export type ExtraRow = { name: string; title: string; options: SlotChoice[]; defaultValue?: string; multi?: boolean };

/** What the sign-up action returns on success (in `data`). */
export type SignUpDone = { when: string; place: string | null; token?: string };

export function SignUp({
  slots,
  fixed,
  slotField = "slot",
  extras = [],
  hidden = {},
  action,
  cancelAction,
  privacyHref = "/residents/privacy",
}: {
  /** The open slots (screen 1). Omit for events. */
  slots?: SlotChoice[];
  /** Events: the time is already chosen, so screen 1 is skipped. */
  fixed?: string;
  slotField?: string;
  extras?: ExtraRow[];
  hidden?: Record<string, string>;
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  /** Cancels with the token from the success answer. */
  cancelAction: (state: ActionState, fd: FormData) => Promise<ActionState>;
  privacyHref?: string;
}) {
  const router = useRouter();
  const [slot, setSlot] = useState<string | null>(fixed ? "" : null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [extra, setExtra] = useState<Record<string, string | string[]>>(() =>
    Object.fromEntries(extras.map((x) => [x.name, x.multi ? [] : (x.defaultValue ?? "")])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, formAction, pending] = useActionState(action, null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const finished = state?.ok === true;
  const screen = finished ? "done" : slot === null ? "when" : "contact";

  // move focus to the new screen's heading, so screen readers read it
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [screen]);

  // the server's answer: field errors stay next to the field; a slot that filled up meanwhile
  // sends the person back to screen 1 with fresh choices
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state && !state.ok) {
      setErrors(state.errors ?? {});
      if (state.errors?.[slotField] && !fixed) setSlot(null);
    }
  }
  useEffect(() => {
    if (state && !state.ok && state.errors?.[slotField]) router.refresh();
  }, [state, router, slotField]);

  if (screen === "done" && state) {
    const done = state.data as SignUpDone | undefined;
    return <Done state={state} done={done} cancelAction={cancelAction} headingRef={headingRef} />;
  }

  if (screen === "when") {
    return (
      <section aria-labelledby="signup-heading">
        <h2 id="signup-heading" ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold leading-snug">
          {s.whenTitle}
        </h2>
        {errors[slotField] && <p role="alert" className="mt-3 rounded-lg bg-bad-soft p-3 text-xl font-bold text-bad">{errors[slotField]}</p>}
        {!slots?.length ? (
          <p className="mt-5 rounded-2xl border-4 border-ink p-5 text-2xl font-bold">{s.noSlots}</p>
        ) : (
          <ul className="mt-5 space-y-4">
            {slots.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    setSlot(o.value);
                    setErrors({});
                  }}
                  className="flex min-h-[72px] w-full items-center justify-center rounded-2xl border-4 border-ink bg-white px-4 py-4 text-center text-2xl font-bold text-ink hover:bg-sand"
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  const chosen = fixed ?? slots?.find((o) => o.value === slot)?.label ?? "";

  function submit() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = he.name;
    const p = normalizePhone(phone);
    if (!p.ok) errs.phone = PHONE_MESSAGES[p.reason];
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const fd = new FormData();
    for (const [k, v] of Object.entries(hidden)) fd.append(k, v);
    if (!fixed && slot) fd.append(slotField, slot);
    fd.append("name", name);
    fd.append("phone", phone);
    for (const [k, v] of Object.entries(extra)) {
      if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
      else fd.append(k, v);
    }
    fd.append(HONEYPOT, honeypotRef.current?.value ?? "");
    startTransition(() => formAction(fd));
  }

  return (
    <section aria-labelledby="signup-heading">
      <div className="hp" aria-hidden="true">
        <label>
          {HONEYPOT}
          <input ref={honeypotRef} name={HONEYPOT} tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-4 border-brand bg-brand-soft p-4">
        <div>
          <p className="font-bold">{s.chosen}</p>
          <p className="text-2xl font-extrabold">{chosen}</p>
        </div>
        {!fixed && (
          <button type="button" onClick={() => setSlot(null)} className={buttonClass.secondary}>
            {s.change}
          </button>
        )}
      </div>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h2 id="signup-heading" ref={headingRef} tabIndex={-1} className="text-3xl font-extrabold leading-snug">
          {s.contactTitle}
        </h2>
        <div className="mt-5 space-y-6">
          <TextInput id="name" label={s.nameLabel} value={name} onChange={setName} error={errors.name} autoComplete="name" />
          <TextInput id="phone" label={s.phoneLabel} value={phone} onChange={setPhone} error={errors.phone} autoComplete="tel" tel />
          {extras.map((x) => (
            <ChoiceRow key={x.name} row={x} value={extra[x.name]} error={errors[x.name]} onChange={(v) => setExtra((e) => ({ ...e, [x.name]: v }))} />
          ))}
        </div>
        {state && !state.ok && state.message && !state.errors?.[slotField] && (
          <p role="alert" className="mt-6 rounded-xl border-s-8 border-bad bg-bad-soft p-4 text-xl font-bold text-bad">
            {state.message}
          </p>
        )}
        <button type="submit" disabled={pending} className={`${buttonClass.primary} mt-8 w-full min-h-[72px] text-2xl`}>
          {pending ? s.sending : s.submit}
        </button>
        <p className="mt-4">
          {s.privacy}{" "}
          <Link href={privacyHref} className="font-bold underline">
            {s.privacyLink}
          </Link>
        </p>
      </form>
    </section>
  );
}

function TextInput({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
  tel = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete: string;
  tel?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-2xl font-bold">
        {label}
      </label>
      <input
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={tel ? "tel" : "text"}
        inputMode={tel ? "tel" : undefined}
        dir={tel ? "ltr" : undefined}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-2 min-h-16 w-full rounded-xl border-2 border-ink bg-white px-4 py-3 text-2xl ${tel ? "text-end" : ""}`}
      />
      {error && (
        <p id={`${id}-error`} className="mt-2 rounded-lg bg-bad-soft p-3 font-bold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

function ChoiceRow({ row, value, error, onChange }: { row: ExtraRow; value: string | string[]; error?: string; onChange: (v: string | string[]) => void }) {
  const selected = Array.isArray(value) ? value : [value];
  const labelId = `${row.name}-label`;
  return (
    <div>
      <p id={labelId} className="mb-2 text-2xl font-bold">
        {row.title}
      </p>
      <div
        role={row.multi ? "group" : "radiogroup"}
        aria-labelledby={labelId}
        aria-describedby={error ? `${row.name}-error` : undefined}
        className="grid grid-cols-2 gap-3"
      >
        {row.options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              role={row.multi ? undefined : "radio"}
              aria-checked={row.multi ? undefined : on}
              aria-pressed={row.multi ? on : undefined}
              onClick={() => {
                if (!row.multi) return onChange(o.value);
                const list = value as string[];
                onChange(list.includes(o.value) ? list.filter((x) => x !== o.value) : [...list, o.value]);
              }}
              className={`relative flex min-h-16 min-w-0 items-center justify-center rounded-xl border-4 px-3 py-3 text-center text-xl font-bold ${
                on ? "border-brand bg-brand text-white" : "border-ink bg-white text-ink hover:bg-sand"
              }`}
            >
              <span className="min-w-0 [overflow-wrap:anywhere] [word-break:keep-all]">{o.label}</span>
              {on && <CheckIcon className="absolute end-[6px] top-[6px] size-[20px]" />}
            </button>
          );
        })}
      </div>
      {error && (
        <p id={`${row.name}-error`} className="mt-2 rounded-lg bg-bad-soft p-3 font-bold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

function Done({
  state,
  done,
  cancelAction,
  headingRef,
}: {
  state: NonNullable<ActionState>;
  done?: SignUpDone;
  cancelAction: (state: ActionState, fd: FormData) => Promise<ActionState>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const [cancelState, cancel, cancelling] = useActionState(cancelAction, null);
  if (cancelState?.ok) {
    return (
      <section aria-labelledby="signup-cancelled" className="rounded-2xl border-4 border-ink bg-white p-6 text-center">
        <h2 id="signup-cancelled" tabIndex={-1} className="text-3xl font-extrabold">
          {s.cancelled}
        </h2>
        <Link href="/residents" className={`${buttonClass.primary} mt-6 w-full min-h-[72px] text-xl`}>
          {t.backHome}
        </Link>
      </section>
    );
  }
  return (
    <section aria-labelledby="signup-done" className="rounded-2xl border-4 border-ok bg-ok-soft p-6 text-center">
      <h2 id="signup-done" ref={headingRef} tabIndex={-1} className="text-4xl font-extrabold text-ok">
        {s.done} <span aria-hidden="true">✓</span>
      </h2>
      {state.waitlist ? (
        <p className="mt-3 text-2xl font-bold">{s.waitlist}</p>
      ) : (
        done && <p className="mt-3 text-2xl font-extrabold">{s.seeYou(done.when, done.place)}</p>
      )}
      {state.code && (
        <div className="mx-auto mt-6 max-w-sm rounded-xl border-2 border-ink bg-white p-4">
          <p className="text-xl">{s.codeLabel}</p>
          <p className="text-5xl font-extrabold tracking-widest" dir="ltr">
            {state.code}
          </p>
          <p className="mt-2 text-xl">{s.codeHint}</p>
        </div>
      )}
      <Link href="/residents" className={`${buttonClass.primary} mt-6 w-full min-h-[72px] text-xl`}>
        {t.backHome}
      </Link>
      {done?.token && (
        <form action={cancel} className="mt-4">
          <input type="hidden" name="token" value={done.token} />
          <button type="submit" disabled={cancelling} className={`${buttonClass.secondary} w-full min-h-[72px] text-xl`}>
            {s.cancel}
          </button>
          {cancelState && !cancelState.ok && cancelState.message && (
            <p role="alert" className="mt-2 font-bold text-bad">
              {cancelState.message}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
