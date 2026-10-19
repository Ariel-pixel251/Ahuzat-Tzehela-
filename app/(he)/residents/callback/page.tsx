import type { Metadata } from "next";
import { requestCallback } from "@/app/actions/residents";
import { Wizard } from "@/components/Wizard";
import { residentsText as t } from "@/lib/i18n";
import { callbackSteps } from "@/lib/wizard-steps";

export const metadata: Metadata = { title: t.pages.callback.title };

export default function CallbackPage() {
  return (
    <>
      <h1 className="text-4xl font-extrabold">{t.pages.callback.title}</h1>
      <p className="mb-6 mt-3 text-xl">{t.pages.callback.intro}</p>
      <Wizard steps={callbackSteps} action={requestCallback} done={t.confirm.callback} />
    </>
  );
}
