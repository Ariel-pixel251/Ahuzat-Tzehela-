"use client";

import Link from "next/link";
import { joinPodcastAsStudent } from "@/app/actions/students";
import { ActionForm, Checkbox, MultiSelect, SelectField, TextField } from "@/components/forms";
import { ButtonLink, Notice } from "@/components/ui";
import { LANGUAGES } from "@/config/languages";
import { ARRANGE_BY_MESSAGE, PODCAST_TOPICS } from "@/config/options";
import { studentsText as t } from "@/lib/i18n";

/** `times`: the team's open podcast times (id and label) that still have places for students. */
export function PodcastSignup({ times }: { times: { value: string; label: string }[] }) {
  const f = t.form;
  return (
    <ActionForm
      action={joinPodcastAsStudent}
      submitLabel={f.submit}
      pendingLabel={f.sending}
      success={(s) => (
        <Notice kind="ok">
          <p className="font-bold">{t.podcast.joined}</p>
          {/* local development only (no email): the link is shown instead of emailed */}
          {(s.data as { devLink?: string } | undefined)?.devLink && (
            <ButtonLink href={(s.data as { devLink: string }).devLink} className="mt-3">
              {t.podcast.openPage}
            </ButtonLink>
          )}
        </Notice>
      )}
    >
      <TextField name="name" label={f.name} autoComplete="name" required />
      <TextField name="email" label={f.email} type="email" autoComplete="email" required />
      <TextField name="phone" label={f.phoneOptional} hint={f.phoneHint} type="tel" autoComplete="tel" />
      <MultiSelect
        name="topics"
        label={t.podcast.topics}
        hint={f.languagesHint}
        options={PODCAST_TOPICS.map((o) => ({ value: o.code, label: o.en }))}
        summary={f.selected}
      />
      <SelectField name="language" label={t.podcast.language} defaultValue="en" options={LANGUAGES.map((l) => ({ value: l.code, label: l.en }))} />
      <SelectField
        name="time"
        label={t.podcast.time}
        hint={t.podcast.timeHint}
        defaultValue={times[0]?.value ?? ARRANGE_BY_MESSAGE}
        options={[...times, { value: ARRANGE_BY_MESSAGE, label: t.podcast.arrangeByMessage }]}
      />
      <Checkbox
        name="consent"
        required
        label={
          <>
            {f.consent}{" "}
            <Link href="/students/privacy" className="underline">
              {f.privacyLink}
            </Link>
          </>
        }
      />
    </ActionForm>
  );
}
