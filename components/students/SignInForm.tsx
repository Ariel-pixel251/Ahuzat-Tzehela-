"use client";

import { requestSignInLink } from "@/app/actions/students";
import { ActionForm, TextField } from "@/components/forms";
import { Notice } from "@/components/ui";
import { studentsText as t } from "@/lib/i18n";

export function SignInForm() {
  return (
    <ActionForm
      action={requestSignInLink}
      submitLabel={t.signIn.send}
      pendingLabel={t.form.sending}
      success={(s) => {
        const devLink = (s.data as { devLink?: string } | undefined)?.devLink;
        return devLink ? (
          <Notice kind="warn">
            <p>{t.signIn.devLink}</p>
            <a href={devLink} className="break-all font-bold underline">{devLink}</a>
          </Notice>
        ) : (
          <Notice kind="ok">{s.message}</Notice>
        );
      }}
    >
      <TextField name="name" label={t.form.name} autoComplete="name" required />
      <TextField name="email" label={t.form.email} type="email" autoComplete="email" required />
      <TextField name="phone" label={t.form.phoneOptional} hint={t.form.phoneHint} type="tel" autoComplete="tel" />
    </ActionForm>
  );
}
