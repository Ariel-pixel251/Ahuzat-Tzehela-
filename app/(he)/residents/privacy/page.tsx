import type { Metadata } from "next";
import { residentsText as t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.pages.privacy.title };

export default function PrivacyPage() {
  return (
    <>
      <h1 className="mb-6 text-4xl font-extrabold">{t.pages.privacy.title}</h1>
      <ul className="space-y-4 text-xl">
        {t.pages.privacy.body.map((line) => (
          <li key={line} className="rounded-xl bg-sand p-4">{line}</li>
        ))}
      </ul>
    </>
  );
}
