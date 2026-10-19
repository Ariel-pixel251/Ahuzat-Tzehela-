import type { Metadata } from "next";
import { requestHelp } from "@/app/actions/residents";
import { Wizard } from "@/components/Wizard";
import { residentsText as t } from "@/lib/i18n";
import { helpSteps } from "@/lib/wizard-steps";

export const metadata: Metadata = { title: t.pages.help.title };

export default function HelpPage() {
  return (
    <>
      <h1 className="mb-6 text-4xl font-extrabold">{t.pages.help.title}</h1>
      <Wizard steps={helpSteps} action={requestHelp} done={t.confirm.help} />
    </>
  );
}
