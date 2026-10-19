import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { acceptCodeOfConduct, markRequestDone, releaseRequest } from "@/app/actions/students";
import { ActionButton } from "@/components/ActionButton";
import { ActionForm, Checkbox } from "@/components/forms";
import { DigitalRequestSummary } from "@/components/students/DigitalRequestCard";
import { Badge, Notice, PageTitle } from "@/components/ui";
import { currentStudent } from "@/lib/auth/student";
import { listStudentDigitalRequests } from "@/lib/db/digital";
import { sharedText, studentsText as t } from "@/lib/i18n";
import { formatPhone } from "@/lib/phone";
import { tryDb } from "@/lib/server";

export const metadata: Metadata = { title: t.mine.title, robots: { index: false } };
export const dynamic = "force-dynamic";

/** A student's own requests. Contact details appear only after the code of conduct is accepted. */
export default async function MyRequests({ searchParams }: { searchParams: Promise<{ taken?: string }> }) {
  const { taken } = await searchParams;
  const db = await tryDb();
  if (!db) return <Notice kind="warn">{sharedText.en.errors.unavailable}</Notice>;
  const student = await currentStudent(db);
  if (!student) redirect("/students/sign-in");
  const requests = await listStudentDigitalRequests(db, student.id);
  const accepted = Boolean(student.conduct_accepted_at);
  return (
    <>
      <PageTitle>{t.mine.title}</PageTitle>
      {taken && <Notice kind="ok" className="mb-6">{taken === "taken" ? t.digital.taken : t.digital.takenWaiting}</Notice>}
      {!accepted && requests.length > 0 && (
        <section aria-labelledby="conduct" className="mb-8 rounded-2xl border-4 border-brand p-5">
          <h2 id="conduct" className="text-2xl font-extrabold">{t.mine.conductTitle}</h2>
          <ul className="my-3 list-disc space-y-1 ps-6">
            {t.mine.conduct.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <ActionForm action={acceptCodeOfConduct} submitLabel={t.mine.conductButton}>
            <Checkbox name="accept" label={t.mine.conductAccept} required />
          </ActionForm>
        </section>
      )}
      {requests.length === 0 ? (
        <p>{t.mine.none}</p>
      ) : (
        <ul className="space-y-4">
          {requests.map((r) => {
            const approved = Boolean(r.approved_at);
            return (
              <li key={r.id} className="rounded-2xl border-2 border-line p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-extrabold">{accepted && approved ? r.resident_name : r.resident_name.split(" ")[0]}</h2>
                  <Badge tone={r.status === "done" ? "ok" : "neutral"}>{t.mine.statuses[r.status as "assigned" | "done"]}</Badge>
                </div>
                <DigitalRequestSummary r={r} />
                {!approved && <p className="mt-2 font-bold text-warn">{t.mine.waitingApproval}</p>}
                {accepted && approved && (
                  <p className="mt-2">
                    <span className="font-bold">{t.mine.contact}: </span>
                    <a href={`tel:${r.resident_phone}`} dir="ltr" className="font-bold underline">{formatPhone(r.resident_phone)}</a>
                    {r.resident_email && <span dir="ltr"> · {r.resident_email}</span>}
                  </p>
                )}
                {r.status === "assigned" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {approved && <ActionButton action={markRequestDone} fields={{ request: r.id }} label={t.mine.done} />}
                    <ActionButton action={releaseRequest} fields={{ request: r.id }} label={t.mine.release} variant="secondary" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
