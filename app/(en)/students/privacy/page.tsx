import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";
import { studentsText as t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.privacy.title };

export default function PrivacyPage() {
  return (
    <>
      <PageTitle>{t.privacy.title}</PageTitle>
      <ul className="list-disc space-y-2 ps-6">
        {t.privacy.body.map((line) => <li key={line}>{line}</li>)}
      </ul>
    </>
  );
}
