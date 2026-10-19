import type { Metadata } from "next";
import { signOut, takeRequest } from "@/app/actions/students";
import { ActionButton } from "@/components/ActionButton";
import { DigitalRequestSummary } from "@/components/students/DigitalRequestCard";
import { ButtonLink, buttonClass, Notice, PageTitle } from "@/components/ui";
import { currentStudent } from "@/lib/auth/student";
import { listOpenDigitalRequests } from "@/lib/db/digital";
import { sharedText, studentsText as t } from "@/lib/i18n";
import { dateBadge } from "@/lib/i18n/format";
import { tryDb } from "@/lib/server";

export const metadata: Metadata = { title: t.digital.title };
export const dynamic = "force-dynamic";

export default async function DigitalBoard() {
  const db = await tryDb();
  if (!db) return <Notice kind="warn">{sharedText.en.errors.unavailable}</Notice>;
  const [student, requests] = await Promise.all([currentStudent(db), listOpenDigitalRequests(db)]);
  return (
    <>
      <PageTitle lead={t.digital.lead}>{t.digital.title}</PageTitle>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {student ? (
          <>
            <span>{t.digital.signedInAs(student.name)}</span>
            <ButtonLink href="/students/digital/mine" variant="secondary">{t.digital.myRequests}</ButtonLink>
            <form action={signOut}>
              <button type="submit" className={buttonClass.small}>{t.digital.signOut}</button>
            </form>
          </>
        ) : (
          <>
            <span>{t.digital.signInToTake}</span>
            <ButtonLink href="/students/sign-in">{t.digital.signIn}</ButtonLink>
          </>
        )}
      </div>
      {requests.length === 0 ? (
        <p>{t.digital.none}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {requests.map((r) => (
            <li key={r.id} className="rounded-2xl border-2 border-line p-4">
              <h2 className="text-xl font-extrabold">{r.first_name}</h2>
              <p className="text-sm text-muted">
                {t.digital.posted} {dateBadge(r.created_at.toISOString().slice(0, 10), "en").short}
              </p>
              <DigitalRequestSummary r={r} />
              {student && (
                <div className="mt-3">
                  <ActionButton action={takeRequest} fields={{ request: r.id }} label={t.digital.take} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
