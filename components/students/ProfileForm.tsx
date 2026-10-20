"use client";

import { useState } from "react";
import { saveStudentProfile } from "@/app/actions/students";
import { ActionForm, Checkbox, SelectField, TextField } from "@/components/forms";
import { AGE_GROUPS } from "@/config/options";
import { studentsText as t } from "@/lib/i18n";

/** Age group, and for under-18s a parent or guardian's name, phone and okay. */
export function ProfileForm({
  defaults,
}: {
  defaults: { phone: string; age_group: string; guardian_name: string; guardian_phone: string; guardian_confirmed: boolean };
}) {
  const [age, setAge] = useState(defaults.age_group);
  return (
    <ActionForm action={saveStudentProfile} submitLabel={t.mine.saveProfile} pendingLabel={t.form.sending}>
      <TextField name="phone" label={t.form.phoneOptional} hint={t.form.phoneHint} type="tel" autoComplete="tel" defaultValue={defaults.phone} />
      <div onChange={(e) => setAge((e.target as unknown as HTMLSelectElement).value)}>
        <SelectField
          name="age_group"
          label={t.mine.ageGroup}
          defaultValue={defaults.age_group}
          options={[{ value: "", label: "Choose…" }, ...AGE_GROUPS.map((a) => ({ value: a.code, label: a.en }))]}
        />
      </div>
      {age === "under-18" && (
        <>
          <TextField name="guardian_name" label={t.mine.guardianName} defaultValue={defaults.guardian_name} required />
          <TextField name="guardian_phone" label={t.mine.guardianPhone} type="tel" defaultValue={defaults.guardian_phone} required />
          <Checkbox name="guardian_confirm" label={t.mine.guardianConfirm} required />
        </>
      )}
    </ActionForm>
  );
}
