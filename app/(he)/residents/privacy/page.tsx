import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";
import { Notice } from "@/components/ui";
import { residentsText as t } from "@/lib/i18n";
import { legalText } from "@/lib/legal";

export const metadata: Metadata = { title: t.pages.privacy.title };

export default async function PrivacyPage() {
  return (
    <article className="text-xl">
      <Notice kind="warn" className="mb-6">{t.pages.privacy.draft}</Notice>
      <Markdown source={await legalText("privacy-residents")} />
    </article>
  );
}
