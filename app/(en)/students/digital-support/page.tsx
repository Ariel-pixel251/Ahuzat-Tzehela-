import type { Metadata } from "next";
import { signOut, volunteerForSlotAction } from "@/app/actions/students";
import { ActionButton } from "@/components/ActionButton";
import { Badge, ButtonLink, buttonClass, Notice, PageTitle } from "@/components/ui";
import { currentStudent } from "@/lib/auth/student";
import { listStudentSlots, listUpcomingSlots } from "@/lib/db/slots";
import { sharedText, studentsText as t } from "@/lib/i18n";
import { formatSlotWhen } from "@/lib/i18n/format";
import { tryDb } from "@/lib/server";

export const metadata: Metadata = { title: t.digital.title };
export const dynamic = "force-dynamic";

/** Upcoming slots with the helpers still needed; signed-in students volunteer here. */
export default async function DigitalSupportSlots() {
  const db = await tryDb();
  if (!db) return <Notice kind="warn">{sharedText.en.errors.unavailable}</Notice>;
  const student = await currentStudent(db);
  const [slots, mine] = await Promise.all([
    listUpcomingSlots(db),
    student ? listStudentSlots(db, student.id) : Promise.resolve([]),
  ]);
  const myStatus = new Map(mine.map((m) => [m.id, m.volunteer_status]));
  const shown = slots.filter((s) => s.status === "scheduled");
  return (
    <>
      <PageTitle lead={t.digital.lead}>{t.digital.title}</PageTitle>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {student ? (
          <>
            <span>{t.digital.signedInAs(student.name)}</span>
            <ButtonLink href="/students/mine" variant="secondary">{t.nav.mine}</ButtonLink>
            <form action={signOut}>
              <button type="submit" className={buttonClass.small}>{t.digital.signOut}</button>
            </form>
          </>
        ) : (
          <>
            <span>{t.digital.signInToVolunteer}</span>
            <ButtonLink href="/students/sign-in">{t.digital.signIn}</ButtonLink>
          </>
        )}
      </div>
      {shown.length === 0 ? (
        <p>{t.digital.none}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {shown.map((s) => {
            const status = myStatus.get(s.id);
            const enough = s.helpers >= s.helpers_needed;
            return (
              <li key={s.id} className="rounded-2xl border-2 border-line p-4">
                <h2 className="text-xl font-extrabold">{formatSlotWhen(s, "en")}</h2>
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
                  {status === "confirmed" ? (
                    <Badge tone="ok">{t.digital.youreIn}</Badge>
                  ) : status === "pending" ? (
                    <Badge tone="warn">{t.digital.youreWaiting}</Badge>
                  ) : !s.booking_open ? (
                    <Badge>{t.digital.closed}</Badge>
                  ) : enough ? (
                    <Badge>{t.digital.enoughHelpers}</Badge>
                  ) : student ? (
                    <ActionButton action={volunteerForSlotAction} fields={{ slot: s.id }} label={t.digital.volunteer} />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
