import type { Metadata } from "next";
import { proposeLecture } from "@/app/actions/residents";
import { Wizard } from "@/components/Wizard";
import { residentsText as t } from "@/lib/i18n";
import { lectureSteps } from "@/lib/wizard-steps";

export const metadata: Metadata = { title: t.pages.lecture.title };

export default function LecturePage() {
  return (
    <>
      <h1 className="mb-6 text-4xl font-extrabold">{t.pages.lecture.title}</h1>
      <Wizard steps={lectureSteps} action={proposeLecture} done={t.confirm.lecture} />
    </>
  );
}
