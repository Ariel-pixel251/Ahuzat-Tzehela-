import type { Metadata } from "next";
import { ReportForm } from "@/components/students/ReportForm";
import { PageTitle } from "@/components/ui";
import { studentsText as t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.report.title };

export default function ReportPage() {
  return (
    <>
      <PageTitle lead={t.report.lead}>{t.report.title}</PageTitle>
      <ReportForm />
    </>
  );
}
