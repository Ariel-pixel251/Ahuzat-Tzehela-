import type { Metadata } from "next";
import { SlotSignUp } from "@/components/students/CardSignUp";
import { Badge, Notice, PageTitle } from "@/components/ui";
import { listUpcomingSlots } from "@/lib/db/slots";
import { sharedText, studentsText as t } from "@/lib/i18n";
import { formatSlotWhen } from "@/lib/i18n/format";
import { tryDb } from "@/lib/server";

export const metadata: Metadata = { title: t.digital.title };
export const dynamic = "force-dynamic";

/** Upcoming slots with the helpers still needed; students sign up right on the card (no account). */
export default async function DigitalSupportSlots() {
  const db = await tryDb();
  if (!db) return <Notice kind="warn">{sharedText.en.errors.unavailable}</Notice>;
  const shown = (await listUpcomingSlots(db)).filter((s) => s.status === "scheduled");
  return (
    <>
      <PageTitle lead={t.digital.lead}>{t.digital.title}</PageTitle>
      {shown.length === 0 ? (
        <p>{t.digital.none}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {shown.map((s) => {
            const enough = s.helpers >= s.helpers_needed;
            const when = formatSlotWhen(s, "en");
            return (
              <li key={s.id} className="rounded-2xl border-2 border-line p-4">
                <h2 className="text-xl font-extrabold">{when}</h2>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="font-bold">{t.digital.place}</dt>
                  <dd>{s.place_en ?? s.place_he}</dd>
                  {s.note_en && (
                    <>
                      <dt className="font-bold">{t.digital.note}</dt>
                      <dd>{s.note_en}</dd>
                    </>
                  )}
                </dl>
                <p className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={enough ? "ok" : "warn"}>{t.digital.helpers(s.helpers, s.helpers_needed)}</Badge>
                  <Badge>{t.digital.residents(s.booked)}</Badge>
                </p>
                <div className="mt-3">
                  {!s.booking_open ? (
                    <Badge>{t.digital.closed}</Badge>
                  ) : enough ? (
                    <Badge>{t.digital.enoughHelpers}</Badge>
                  ) : (
                    <SlotSignUp slotId={s.id} label={when} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
