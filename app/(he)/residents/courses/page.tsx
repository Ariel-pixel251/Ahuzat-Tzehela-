import type { Metadata } from "next";
import { CoursesView } from "@/components/CoursesView";
import { residentsText as t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.pages.courses.title };
export const dynamic = "force-dynamic";

export default function CoursesPage() {
  return (
    <>
      <h1 className="text-4xl font-extrabold">{t.pages.courses.title}</h1>
      <CoursesView locale="he" text={t.pages.courses} />
    </>
  );
}
