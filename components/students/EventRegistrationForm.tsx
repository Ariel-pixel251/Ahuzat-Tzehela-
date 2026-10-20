"use client";

import { registerStudentForEvent } from "@/app/actions/students";
import { ActionForm, MultiSelect, SelectField, TextField } from "@/components/forms";
import { Notice } from "@/components/ui";
import { LANGUAGES } from "@/config/languages";
import { sharedText, studentsText as t } from "@/lib/i18n";
import { Consent } from "./Consent";

const languageOptions = LANGUAGES.map((l) => ({ value: l.code, label: l.en }));

export function EventRegistrationForm({
  eventKey,
  title,
  form,
  showLanguages,
}: {
  eventKey: string;
  title: string;
  form: "general" | "language-night" | "game-night";
  showLanguages: boolean;
}) {
  const f = t.form;
  return (
    <ActionForm
      action={registerStudentForEvent}
      submitLabel={f.submit}
      pendingLabel={f.sending}
      success={(s) => (
        <Notice kind="ok">
          <p className="text-lg font-bold">{s.waitlist ? t.register.waitlist : t.register.registered(title)}</p>
          <p className="mt-1">{t.register.manageHint}</p>
        </Notice>
      )}
    >
      <input type="hidden" name="event" value={eventKey} />
      <TextField name="name" label={f.name} autoComplete="name" required />
      <TextField name="email" label={f.email} type="email" autoComplete="email" required />
      <TextField
        name="phone"
        label={form === "language-night" ? f.phone : f.phoneOptional}
        hint={f.phoneHint}
        type="tel"
        autoComplete="tel"
        required={form === "language-night"}
      />
      <SelectField
        name="attendees"
        label={f.attendees}
        defaultValue="1"
        options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
      />
      {showLanguages && (
        <>
          <MultiSelect name="languages" label={f.languages} hint={f.languagesHint} options={languageOptions} summary={f.selected} />
          <TextField name="other_language" label={f.otherLanguage} />
        </>
      )}
      {form === "game-night" && (
        <SelectField
          name="preferred_language"
          label={f.playLanguage}
          defaultValue="none"
          options={[{ value: "none", label: sharedText.en.noPreference }, ...languageOptions.filter((o) => o.value !== "other")]}
        />
      )}
      <TextField name="notes" label={f.notes} multiline />
      <Consent />
    </ActionForm>
  );
}
