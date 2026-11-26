import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { studentsText as t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.conduct.title };

export default function CodeOfConduct() {
  return (
    <>
      <PageTitle lead={t.conduct.lead}>{t.conduct.title}</PageTitle>
      <ul className="max-w-prose list-disc space-y-2 ps-6">
        {t.conduct.rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </>
  );
}
