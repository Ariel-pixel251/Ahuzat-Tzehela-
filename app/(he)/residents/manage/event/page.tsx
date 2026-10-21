import type { Metadata } from "next";
import { cancelRegistrationByToken } from "@/app/actions/residents";
import { ActionButton } from "@/components/ActionButton";
import { Notice } from "@/components/ui";
import { getRegistrationByToken } from "@/lib/db/events";
import { residentsText as t } from "@/lib/i18n";
import { formatDateTime } from "@/lib/i18n/format";
import { tryDb } from "@/lib/server";
import { v } from "@/lib/validation";

export const metadata: Metadata = { title: t.pages.manage.title, robots: { index: false } };

export const dynamic = "force-dynamic";

export default async function ManageEvent({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const parsed = v.token.safeParse((await searchParams).token);
  const db = await tryDb();
  const reg = db && parsed.success ? await getRegistrationByToken(db, parsed.data) : null;
  if (!reg || !parsed.success) return <Notice kind="bad">{t.pages.manage.invalid}</Notice>;
  const token = parsed.data;
  return (
    <>
      <h1 className="mb-6 text-4xl font-extrabold">{t.pages.manage.title}</h1>
      <div className="rounded-2xl border-4 border-ink p-5 text-xl">
        <p className="text-2xl font-bold">{reg.event_title_he}</p>
        <p className="mt-1">{formatDateTime(reg.event_date, reg.event_time, "he")}</p>
        <p className="mt-2 font-bold">{t.pages.status.event[reg.status]}</p>
      </div>
      {reg.status !== "cancelled" && (
        <div className="mt-6">
          <ActionButton
            action={cancelRegistrationByToken}
            fields={{ token, locale: "he" }}
            label={t.pages.manage.cancelRegistration}
            doneMessage={t.pages.manage.cancelled}
            variant="danger"
            className="w-full min-h-[72px] text-2xl"
          />
        </div>
      )}
    </>
  );
}
