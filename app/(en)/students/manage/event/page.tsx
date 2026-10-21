import type { Metadata } from "next";
import { cancelRegistrationByToken } from "@/app/actions/residents";
import { ActionButton } from "@/components/ActionButton";
import { Card, Notice, PageTitle } from "@/components/ui";
import { getRegistrationByToken } from "@/lib/db/events";
import { formatDateTime } from "@/lib/i18n/format";
import { studentsText as t } from "@/lib/i18n";
import { tryDb } from "@/lib/server";
import { v } from "@/lib/validation";

export const metadata: Metadata = { title: t.manage.title, robots: { index: false } };

export const dynamic = "force-dynamic";

export default async function ManageEvent({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const parsed = v.token.safeParse((await searchParams).token);
  const db = await tryDb();
  const reg = db && parsed.success ? await getRegistrationByToken(db, parsed.data) : null;
  if (!reg || !parsed.success) return <Notice kind="bad">{t.manage.invalid}</Notice>;
  const token = parsed.data;
  return (
    <>
      <PageTitle>{t.manage.title}</PageTitle>
      <Card className="mb-6">
        <h2 className="text-xl font-extrabold">{reg.event_title_en}</h2>
        <p>{formatDateTime(reg.event_date, reg.event_time, "en")}</p>
        <p className="font-bold">{t.manage.statuses[reg.status]}</p>
      </Card>
      {reg.status !== "cancelled" && (
        <ActionButton action={cancelRegistrationByToken} fields={{ token, locale: "en" }} label={t.manage.cancel} doneMessage={t.manage.cancelled} variant="danger" />
      )}
    </>
  );
}
