import type { Metadata } from "next";
import { bookHelpSlot } from "@/app/actions/residents";
import { Notice } from "@/components/ui";
import { Wizard } from "@/components/Wizard";
import { listUpcomingSlots } from "@/lib/db/slots";
import { residentsText as t, sharedText } from "@/lib/i18n";
import { tryDb } from "@/lib/server";
import { helpSteps, slotOptions } from "@/lib/wizard-steps";

export const metadata: Metadata = { title: t.pages.help.title };
export const dynamic = "force-dynamic";

/** Book digital support: choose an open slot, say what help is needed, leave name and phone. */
export default async function HelpPage() {
  const db = await tryDb();
  const slots = db ? await listUpcomingSlots(db) : [];
  const hasOpenSlot = slotOptions(slots).some((o) => !o.disabled);
  return (
    <>
      <h1 className="text-4xl font-extrabold">{t.pages.help.title}</h1>
      <p className="mb-6 mt-3 text-xl">{t.pages.help.intro}</p>
      {!db ? (
        <Notice kind="warn" className="text-xl">{sharedText.he.errors.unavailable}</Notice>
      ) : hasOpenSlot ? (
        <Wizard steps={helpSteps(slots)} action={bookHelpSlot} done={t.confirm.help} doneDetail="slot" />
      ) : (
        <p className="rounded-2xl border-4 border-ink p-5 text-2xl font-bold">{t.fields.noSlots}</p>
      )}
    </>
  );
}
