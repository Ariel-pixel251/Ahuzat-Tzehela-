import type { Metadata } from "next";
import { requestLesson } from "@/app/actions/residents";
import { Notice } from "@/components/ui";
import { Wizard } from "@/components/Wizard";
import { listLessonTopics } from "@/lib/db/misc";
import { residentsText as t, sharedText } from "@/lib/i18n";
import { tryDb } from "@/lib/server";
import { lessonSteps } from "@/lib/wizard-steps";

export const metadata: Metadata = { title: t.pages.lessons.title };
export const dynamic = "force-dynamic";

export default async function LessonsPage() {
  const db = await tryDb();
  const topics = db ? await listLessonTopics(db) : null;
  return (
    <>
      <h1 className="text-4xl font-extrabold">{t.pages.lessons.title}</h1>
      <p className="mb-6 mt-3 text-xl">{t.pages.lessons.intro}</p>
      {topics ? (
        <Wizard steps={lessonSteps(topics)} action={requestLesson} done={t.confirm.lessons} />
      ) : (
        <Notice kind="warn">{sharedText.he.errors.unavailable}</Notice>
      )}
    </>
  );
}
