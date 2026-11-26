import type { Metadata } from "next";
import { bookHelpSlot, cancelHelpByToken } from "@/app/actions/residents";
import { SignUp } from "@/components/residents/SignUp";
import { Notice } from "@/components/ui";
import { listUpcomingSlots } from "@/lib/db/slots";
import { residentsText as t, sharedText } from "@/lib/i18n";
import { helpChoices, helpExtras } from "@/lib/resident-signup";
import { tryDb } from "@/lib/server";

export const metadata: Metadata = { title: t.pages.help.title };
export const dynamic = "force-dynamic";

/** Book digital support: pick an open slot, then name and phone. */
export default async function HelpPage() {
  const db = await tryDb();
  return (
    <>
      <h1 className="mb-6 text-4xl font-extrabold">{t.pages.help.title}</h1>
      {!db ? (
        <Notice kind="warn" className="text-xl">{sharedText.he.errors.unavailable}</Notice>
      ) : (
        <SignUp slots={helpChoices(await listUpcomingSlots(db))} extras={helpExtras} action={bookHelpSlot} cancelAction={cancelHelpByToken} />
      )}
    </>
  );
}
