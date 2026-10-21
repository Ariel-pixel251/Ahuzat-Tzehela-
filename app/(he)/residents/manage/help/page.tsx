import type { Metadata } from "next";
import { cancelHelpByToken } from "@/app/actions/residents";
import { ActionButton } from "@/components/ActionButton";
import { Notice } from "@/components/ui";
import { getBookingByToken, getSlot } from "@/lib/db/slots";
import { residentsText as t } from "@/lib/i18n";
import { formatSlot } from "@/lib/i18n/format";
import { tryDb } from "@/lib/server";
import { v } from "@/lib/validation";

export const metadata: Metadata = { title: t.pages.manage.title, robots: { index: false } };
export const dynamic = "force-dynamic";

/** The link in the booking email: see the booked slot, or cancel it. */
export default async function ManageHelp({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const parsed = v.token.safeParse((await searchParams).token);
  const db = await tryDb();
  const booking = db && parsed.success ? await getBookingByToken(db, parsed.data) : null;
  const slot = db && booking ? await getSlot(db, booking.slot_id) : null;
  if (!booking || !slot || !parsed.success) return <Notice kind="bad" className="text-xl">{t.pages.manage.invalid}</Notice>;
  const active = booking.status === "confirmed" && slot.status === "scheduled";
  return (
    <>
      <h1 className="mb-6 text-4xl font-extrabold">{t.pages.manage.title}</h1>
      <div className="rounded-2xl border-4 border-ink p-5 text-xl">
        <p className="text-lg">{t.pages.status.labels.digital}</p>
        <p className="text-2xl font-bold">{formatSlot(slot, "he")}</p>
        <p className="mt-2 font-bold">
          {slot.status === "cancelled" ? t.pages.status.digital.slotCancelled : t.pages.status.digital[booking.status]}
        </p>
      </div>
      {active && (
        <div className="mt-6">
          <ActionButton
            action={cancelHelpByToken}
            fields={{ token: parsed.data }}
            label={t.pages.manage.cancel}
            doneMessage={t.pages.manage.cancelled}
            variant="danger"
            className="w-full min-h-[72px] text-2xl"
          />
        </div>
      )}
    </>
  );
}
