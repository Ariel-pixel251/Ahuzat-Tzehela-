import type { Metadata } from "next";
import { CoursesView } from "@/components/CoursesView";
import { PageTitle } from "@/components/ui";
import { studentsText as t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.courses.title };
export const dynamic = "force-dynamic";

export default function CoursesPage() {
  return (
    <>
      <PageTitle>{t.courses.title}</PageTitle>
      <CoursesView locale="en" text={t.courses} />
    </>
  );
}
