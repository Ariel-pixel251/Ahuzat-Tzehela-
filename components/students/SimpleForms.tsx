"use client";

import Link from "next/link";
import { offerLessons, requestVisit } from "@/app/actions/students";
import { ActionForm, Checkbox, MultiSelect, TextField } from "@/components/forms";
import { Notice } from "@/components/ui";
import { studentsText as t } from "@/lib/i18n";

function Consent() {
  return (
    <Checkbox
      name="consent"
      required
      label={
        <>
          {t.form.consent}{" "}
          <Link href="/students/privacy" className="underline">
            {t.form.privacyLink}
          </Link>
        </>
      }
    />
  );
}

export function LessonOfferForm({ topics }: { topics: { id: string; name_en: string }[] }) {
  return (
    <ActionForm action={offerLessons} submitLabel={t.form.submit} pendingLabel={t.form.sending} success={(s) => <Notice kind="ok">{s.message}</Notice>}>
      <TextField name="name" label={t.form.name} autoComplete="name" required />
      <TextField name="email" label={t.form.email} type="email" autoComplete="email" required />
      <TextField name="phone" label={t.form.phoneOptional} type="tel" autoComplete="tel" />
      <MultiSelect name="topics" label={t.lessons.topics} options={topics.map((x) => ({ value: x.id, label: x.name_en }))} summary={t.form.selected} />
      <TextField name="other_topic" label={t.lessons.otherTopic} />
      <TextField name="notes" label={t.form.notes} multiline />
      <Consent />
    </ActionForm>
  );
}

export function VisitForm() {
  return (
    <ActionForm action={requestVisit} submitLabel={t.form.submit} pendingLabel={t.form.sending} success={(s) => <Notice kind="ok">{s.message}</Notice>}>
      <TextField name="name" label={t.form.name} autoComplete="name" required />
      <TextField name="organization" label={t.visit.organization} autoComplete="organization" />
      <TextField name="email" label={t.form.email} type="email" autoComplete="email" required />
      <TextField name="phone" label={t.form.phoneOptional} type="tel" autoComplete="tel" />
      <TextField name="preferred_dates" label={t.visit.dates} />
      <TextField name="group_size" label={t.visit.groupSize} type="number" min={1} max={200} />
      <TextField name="notes" label={t.form.notes} multiline />
      <Consent />
    </ActionForm>
  );
}
