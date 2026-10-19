import type { Metadata } from "next";
import { StatusForm } from "@/components/residents/StatusForm";
import { residentsText as t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.pages.status.title };

export default function StatusPage() {
  return (
    <>
      <h1 className="text-4xl font-extrabold">{t.pages.status.title}</h1>
      <p className="mb-6 mt-3 text-xl">{t.pages.status.intro}</p>
      <StatusForm />
    </>
  );
}
