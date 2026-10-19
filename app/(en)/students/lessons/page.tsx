import type { Metadata } from "next";
import { LessonOfferForm } from "@/components/students/SimpleForms";
import { Notice, PageTitle } from "@/components/ui";
import { listLessonTopics } from "@/lib/db/misc";
import { sharedText, studentsText as t } from "@/lib/i18n";
import { tryDb } from "@/lib/server";

export const metadata: Metadata = { title: t.lessons.title };
export const dynamic = "force-dynamic";

export default async function LessonsPage() {
  const db = await tryDb();
  const topics = db ? await listLessonTopics(db) : null;
  return (
    <>
      <PageTitle lead={t.lessons.lead}>{t.lessons.title}</PageTitle>
      {topics ? <LessonOfferForm topics={topics} /> : <Notice kind="warn">{sharedText.en.errors.unavailable}</Notice>}
    </>
  );
}
