import type { Metadata } from "next";
import { VisitForm } from "@/components/students/SimpleForms";
import { PageTitle } from "@/components/ui";
import { studentsText as t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.visit.title };

export default function VisitPage() {
  return (
    <>
      <PageTitle lead={t.visit.lead}>{t.visit.title}</PageTitle>
      <VisitForm />
    </>
  );
}
