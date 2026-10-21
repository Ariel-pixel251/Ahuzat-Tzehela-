import type { Metadata } from "next";
import { reportProblemAsResident } from "@/app/actions/residents";
import { Wizard } from "@/components/Wizard";
import { residentsText as t } from "@/lib/i18n";
import { reportSteps } from "@/lib/wizard-steps";

export const metadata: Metadata = { title: t.pages.report.title };

export default function ReportPage() {
  return (
    <>
      <h1 className="text-4xl font-extrabold">{t.pages.report.title}</h1>
      <p className="mb-6 mt-3 text-xl">{t.pages.report.intro}</p>
      <Wizard steps={reportSteps} action={reportProblemAsResident} done={t.confirm.report} showCode={false} />
    </>
  );
}
