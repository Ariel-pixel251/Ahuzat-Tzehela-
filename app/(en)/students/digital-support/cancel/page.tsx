import type { Metadata } from "next";
import { cancelSlotPlaceByToken } from "@/app/actions/students";
import { ActionButton } from "@/components/ActionButton";
import { Card, Notice, PageTitle } from "@/components/ui";
import { getSlot, getVolunteerByToken } from "@/lib/db/slots";
import { studentsText as t } from "@/lib/i18n";
import { formatSlot } from "@/lib/i18n/format";
import { tryDb } from "@/lib/server";
import { v } from "@/lib/validation";

export const metadata: Metadata = { title: t.digital.cancelTitle, robots: { index: false } };
export const dynamic = "force-dynamic";

/** The cancel link from the sign-up email: opening it changes nothing; the button (a POST) cancels. */
export default async function CancelSlotPlace({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const parsed = v.token.safeParse((await searchParams).token);
  const db = await tryDb();
  const place = db && parsed.success ? await getVolunteerByToken(db, parsed.data) : null;
  const slot = db && place && place.status !== "cancelled" ? await getSlot(db, place.slot_id) : null;
  if (!parsed.success || !slot) return <Notice kind="bad">{t.digital.invalid}</Notice>;
  return (
    <>
      <PageTitle>{t.digital.cancelTitle}</PageTitle>
      <Card className="mb-6">
        <p className="text-xl font-extrabold">{formatSlot(slot, "en")}</p>
      </Card>
      <ActionButton action={cancelSlotPlaceByToken} fields={{ token: parsed.data }} label={t.digital.cancel} variant="danger" />
    </>
  );
}
