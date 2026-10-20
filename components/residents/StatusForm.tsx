"use client";

import { startTransition, useActionState } from "react";
import { checkStatus } from "@/app/actions/residents";
import { buttonClass } from "@/components/ui";
import type { StatusItem } from "@/lib/db/misc";
import { HONEYPOT } from "@/lib/form";
import { residentsText as t } from "@/lib/i18n";
import { formatDateTime, formatSlot } from "@/lib/i18n/format";

const s = t.pages.status;

function describe(item: StatusItem): string {
  switch (item.type) {
    case "digital": {
      const when = formatSlot(item, "he");
      const status = item.slot_status === "cancelled" ? s.digital.slotCancelled : s.digital[item.status as "confirmed" | "cancelled"] ?? item.status;
      return `${when}: ${status}`;
    }
    case "event":
      return `${item.title_he}, ${formatDateTime(item.date, item.time, "he")}: ${s.event[item.status as "confirmed"] ?? item.status}`;
    case "podcast":
      return s.podcast[item.status as "looking" | "paired"] ?? item.status;
  }
}

export function StatusForm() {
  const [state, action, pending] = useActionState(checkStatus, null);
  const items = state?.ok ? (state.data as StatusItem[]) : [];
  return (
    <>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => action(fd));
        }}
      >
        <div className="hp" aria-hidden="true">
          <input name={HONEYPOT} tabIndex={-1} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="phone" className="block font-bold">{t.fields.phoneLabel}</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" dir="ltr" autoComplete="tel" required
            aria-invalid={state?.errors?.phone ? true : undefined} aria-describedby={state?.errors?.phone ? "phone-error" : undefined}
            className="mt-2 min-h-14 w-full rounded-xl border-2 border-ink px-4 text-end text-xl" />
          {state?.errors?.phone && <p id="phone-error" className="mt-2 rounded-lg bg-bad-soft p-3 font-bold text-bad">{state.errors.phone}</p>}
        </div>
        <div>
          <label htmlFor="code" className="block font-bold">{s.code}</label>
          <input id="code" name="code" inputMode="numeric" pattern="\d{4}" maxLength={4} dir="ltr" required autoComplete="off"
            aria-invalid={state?.errors?.code ? true : undefined} aria-describedby={state?.errors?.code ? "code-error" : undefined}
            className="mt-2 min-h-14 w-40 rounded-xl border-2 border-ink px-4 text-center text-3xl tracking-widest" />
          {state?.errors?.code && <p id="code-error" className="mt-2 rounded-lg bg-bad-soft p-3 font-bold text-bad">{state.errors.code}</p>}
        </div>
        <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full min-h-[72px] text-2xl`}>
          {s.check}
        </button>
      </form>
      <div aria-live="polite" className="mt-8">
        {state && !state.ok && state.message && (
          <p className="rounded-xl border-s-8 border-bad bg-bad-soft p-4 text-xl font-bold text-bad">{state.message}</p>
        )}
        {items.length > 0 && (
          <ul className="space-y-4">
            {items.map((item, i) => (
              <li key={i} className="rounded-2xl border-4 border-ink p-5">
                <p className="text-lg">{s.labels[item.type]}</p>
                <p className="text-2xl font-extrabold">{describe(item)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
