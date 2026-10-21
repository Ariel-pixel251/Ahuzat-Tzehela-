"use client";

import { reportProblemAsStudent } from "@/app/actions/students";
import { ActionForm, TextField } from "@/components/forms";
import { Notice } from "@/components/ui";
import { studentsText as t } from "@/lib/i18n";
import { Consent } from "./Consent";

export function ReportForm() {
  return (
    <ActionForm action={reportProblemAsStudent} submitLabel={t.form.submit} pendingLabel={t.form.sending} success={(s) => <Notice kind="ok">{s.message}</Notice>}>
      <TextField name="message" label={t.report.message} multiline required />
      <TextField name="name" label={t.report.name} autoComplete="name" />
      <TextField name="contact" label={t.report.contact} />
      <Consent />
    </ActionForm>
  );
}
