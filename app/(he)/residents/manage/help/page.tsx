import type { Metadata } from "next";
import { cancelHelpByToken } from "@/app/actions/residents";
import { ActionButton } from "@/components/ActionButton";
import { Notice } from "@/components/ui";
import { DIGITAL_NEEDS, optionLabel } from "@/config/options";
import { getDigitalRequestByToken } from "@/lib/db/digital";
import { residentsText as t } from "@/lib/i18n";
import { tryDb } from "@/lib/server";

export const metadata: Metadata = { title: t.pages.manage.title, robots: { index: false } };

/** Private edit/cancel link, emailed only to residents who gave an email. */
export default async function ManageHelp({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const db = await tryDb();
  const request = db && token ? await getDigitalRequestByToken(db, token) : null;
  if (!request) return <Notice kind="bad">{t.pages.manage.invalid}</Notice>;
  const status = t.pages.status.digital;
  return (
    <>
      <h1 className="mb-6 text-4xl font-extrabold">{t.pages.manage.title}</h1>
      <div className="rounded-2xl border-4 border-ink p-5 text-xl">
        <p className="text-2xl font-bold">{request.needs.map((n) => optionLabel(DIGITAL_NEEDS, n, "he")).join(", ")}</p>
        <p className="mt-2">
          {t.wizard.codeLabel} <span dir="ltr" className="font-bold">{request.code}</span>
        </p>
        <p className="mt-2 font-bold">
          {request.status === "assigned" ? status.assignedWaiting : status[request.status as "open" | "done" | "cancelled"]}
        </p>
      </div>
      {(request.status === "open" || request.status === "assigned") && (
        <div className="mt-6 space-y-4">
          <p className="text-xl">{t.pages.manage.changeByPhone}</p>
          <ActionButton action={cancelHelpByToken} fields={{ token }} label={t.pages.manage.cancel} variant="danger" className="w-full min-h-[72px] text-2xl" />
        </div>
      )}
    </>
  );
}
