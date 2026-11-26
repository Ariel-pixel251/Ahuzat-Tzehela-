"use client";

import Link from "next/link";
import { useState } from "react";
import { signUpForPodcastTime, signUpForSlot } from "@/app/actions/students";
import { ActionForm, Checkbox, SelectField, TextField } from "@/components/forms";
import { buttonClass } from "@/components/ui";
import { LANGUAGES } from "@/config/languages";
import { PODCAST_TOPICS } from "@/config/options";
import { studentsText as t } from "@/lib/i18n";

const c = t.card;

/** "Sign up" opens a short form inside the card; once sent, the card says "You're in". No account. */
function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label={label} className={`${buttonClass.primary} w-full sm:w-auto`}>
        {c.signUp}
      </button>
    );
  }
  return (
    <div className="mt-2 rounded-xl bg-sand p-4">
      {children}
      <button type="button" onClick={() => setOpen(false)} className={`${buttonClass.small} mt-3`}>
        {c.close}
      </button>
    </div>
  );
}

function Done({ message }: { message?: string }) {
  return (
    <div role="status" className="rounded-xl border-s-8 border-ok bg-ok-soft p-4 text-ok">
      <p className="text-xl font-extrabold">{c.youreIn}</p>
      <p className="font-bold">{c.emailSent}</p>
      {message && <p className="mt-1">{message}</p>}
    </div>
  );
}

function Agree({ conduct }: { conduct: boolean }) {
  return (
    <Checkbox
      name="consent"
      required
      label={
        <>
          {c.agree}{" "}
          <Link href="/students/privacy" className="underline" target="_blank">
            {c.privacy}
          </Link>
          {conduct && (
            <>
              {" "}
              {c.and}{" "}
              <Link href="/students/code-of-conduct" className="underline" target="_blank">
                {c.conduct}
              </Link>
            </>
          )}
        </>
      }
    />
  );
}

/** Digital support slot: name, school email, under 18 (then a parent or guardian), and one agreement. */
export function SlotSignUp({ slotId, label }: { slotId: string; label: string }) {
  const [minor, setMinor] = useState(false);
  return (
    <Disclosure label={`${c.signUp}: ${label}`}>
      <ActionForm action={signUpForSlot} submitLabel={c.signUp} pendingLabel={t.form.sending} success={(s) => <Done message={s.message} />}>
        <input type="hidden" name="slot" value={slotId} />
        <TextField name="name" label={t.form.name} autoComplete="name" required />
        <TextField name="email" label={c.schoolEmail} type="email" autoComplete="email" required />
        <label className="flex min-h-11 items-center gap-3 font-bold">
          <input type="checkbox" name="under_18" checked={minor} onChange={(e) => setMinor(e.target.checked)} className="size-6" />
          {c.under18}
        </label>
        {minor && (
          <>
            <TextField name="guardian_name" label={c.guardianName} required />
            <TextField name="guardian_phone" label={c.guardianPhone} type="tel" hint={t.form.phoneHint} required />
          </>
        )}
        <Agree conduct />
      </ActionForm>
    </Disclosure>
  );
}

/** Podcast time: name, school email, one topic, language (English unless changed), and the privacy notice. */
export function PodcastTimeSignUp({ timeId, label }: { timeId: string; label: string }) {
  return (
    <Disclosure label={`${c.signUp}: ${label}`}>
      <ActionForm action={signUpForPodcastTime} submitLabel={c.signUp} pendingLabel={t.form.sending} success={(s) => <Done message={s.message} />}>
        <input type="hidden" name="time" value={timeId} />
        <TextField name="name" label={t.form.name} autoComplete="name" required />
        <TextField name="email" label={c.schoolEmail} type="email" autoComplete="email" required />
        <SelectField name="topic" label={t.podcast.topic} options={PODCAST_TOPICS.map((o) => ({ value: o.code, label: o.en }))} />
        <SelectField name="language" label={t.podcast.language} defaultValue="en" options={LANGUAGES.map((l) => ({ value: l.code, label: l.en }))} />
        <Agree conduct={false} />
      </ActionForm>
    </Disclosure>
  );
}
