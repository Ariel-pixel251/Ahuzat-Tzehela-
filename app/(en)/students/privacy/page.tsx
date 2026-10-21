import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";
import { Notice } from "@/components/ui";
import { studentsText as t } from "@/lib/i18n";
import { legalText } from "@/lib/legal";

export const metadata: Metadata = { title: t.privacy.title };

export default async function PrivacyPage() {
  return (
    <article>
      <Notice kind="warn" className="mb-6">{t.privacy.draft}</Notice>
      <Markdown source={await legalText("privacy-students")} />
    </article>
  );
}
