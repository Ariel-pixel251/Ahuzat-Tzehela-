import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { acceptCodeOfConduct, cancelMyPlace, signOut } from "@/app/actions/students";
import { ActionButton } from "@/components/ActionButton";
import { ActionForm, Checkbox } from "@/components/forms";
import { ProfileForm } from "@/components/students/ProfileForm";
import { Badge, ButtonLink, buttonClass, Notice, PageTitle } from "@/components/ui";
import { DIGITAL_NEEDS, optionLabel } from "@/config/options";
import { currentStudent } from "@/lib/auth/student";
import { listMyEventRegistrations } from "@/lib/db/events";
import { getParticipantByEmail } from "@/lib/db/podcast";
import { CONTACT_WINDOW_HOURS, listResidentsForVolunteer, listStudentSlots } from "@/lib/db/slots";
import { profileComplete } from "@/lib/db/students";
import { sharedText, studentsText as t } from "@/lib/i18n";
import { formatDateTime, formatSlot } from "@/lib/i18n/format";
import { formatPhone } from "@/lib/phone";
import { tryDb } from "@/lib/server";

export const metadata: Metadata = { title: t.mine.title, robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * A signed-in student's sign-ups: profile (age group, guardian), the code of conduct, their slots
 * with the residents booked into them, and their event and podcast sign-ups.
 */
export default async function MySignUps() {
  const db = await tryDb();
  if (!db) return <Notice kind="warn">{sharedText.en.errors.unavailable}</Notice>;
  const student = await currentStudent(db);
  if (!student) redirect("/students/sign-in");
  const [slots, residents, registrations, podcast] = await Promise.all([
    listStudentSlots(db, student.id),
    listResidentsForVolunteer(db, student.id),
    student.email ? listMyEventRegistrations(db, student.email) : Promise.resolve([]),
    student.email ? getParticipantByEmail(db, student.email) : Promise.resolve(null),
  ]);
  const accepted = Boolean(student.conduct_accepted_at);
  return (
    <>
      <PageTitle lead={t.digital.signedInAs(student.name)}>{t.mine.title}</PageTitle>

      <section aria-labelledby="profile" className="mb-8 rounded-2xl border-2 border-line p-5">
        <h2 id="profile" className="text-2xl font-extrabold">{t.mine.profileTitle}</h2>
        <p className="mb-4 mt-1">{t.mine.profileLead}</p>
        <ProfileForm
          defaults={{
            phone: student.phone ?? "",
            age_group: student.age_group ?? "",
            guardian_name: student.guardian_name ?? "",
            guardian_phone: student.guardian_phone ?? "",
            guardian_confirmed: Boolean(student.guardian_confirmed_at),
          }}
        />
      </section>

      <section aria-labelledby="conduct" className={`mb-8 rounded-2xl p-5 ${accepted ? "border-2 border-line" : "border-4 border-brand"}`}>
        <h2 id="conduct" className="text-2xl font-extrabold">{t.mine.conductTitle}</h2>
        <ul className="my-3 list-disc space-y-1 ps-6">
          {t.mine.conduct.map((line) => <li key={line}>{line}</li>)}
        </ul>
        {accepted ? (
          <p className="font-bold text-ok">{t.mine.conductAccepted}</p>
        ) : (
          <ActionForm action={acceptCodeOfConduct} submitLabel={t.mine.conductButton}>
            <Checkbox name="accept" label={t.mine.conductAccept} required />
          </ActionForm>
        )}
      </section>

      <section aria-labelledby="slots" className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="slots" className="text-2xl font-extrabold">{t.mine.slotsTitle}</h2>
          <ButtonLink href="/students/digital-support" variant="small">{t.mine.browse}</ButtonLink>
        </div>
        {!profileComplete(student) && <Notice kind="warn" className="mb-4">{t.digital.profileNeeded}</Notice>}
        {slots.length === 0 ? (
          <p>{t.mine.none}</p>
        ) : (
          <ul className="space-y-4">
            {slots.map((s) => {
              const people = residents.filter((r) => r.slot_id === s.id);
              return (
                <li key={s.volunteer_id} className="rounded-2xl border-2 border-line p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-extrabold">{formatSlot(s, "en")}</h3>
                    {s.status === "cancelled" ? (
                      <Badge tone="bad">{t.digital.notOpen}</Badge>
                    ) : (
                      <Badge tone={s.volunteer_status === "confirmed" ? "ok" : "warn"}>
                        {t.mine.statuses[s.volunteer_status as "confirmed" | "pending"]}
                      </Badge>
                    )}
                  </div>
                  <h4 className="mt-3 font-bold">{t.mine.residentsTitle}</h4>
                  {people.length === 0 ? (
                    <p>{t.mine.noResidents}</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {people.map((p, i) => (
                        <li key={i}>
                          <span className="font-bold">{p.first_name}</span>
                          {": "}
                          {p.needs.map((n) => optionLabel(DIGITAL_NEEDS, n, "en")).join(", ")}
                          {p.needs_other ? ` (${p.needs_other})` : ""}
                          {p.phone && (
                            <>
                              {" · "}
                              {t.mine.phone}{" "}
                              <a href={`tel:${p.phone}`} dir="ltr" className="font-bold underline">{formatPhone(p.phone)}</a>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {people.length > 0 && !people.some((p) => p.phone) && (
                    <p className="mt-2 text-sm">{t.mine.phoneLater(CONTACT_WINDOW_HOURS)}</p>
                  )}
                  {s.status === "scheduled" && (
                    <div className="mt-3">
                      <ActionButton action={cancelMyPlace} fields={{ volunteer: s.volunteer_id }} label={t.mine.cancel} variant="secondary" />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="events" className="mb-8">
        <h2 id="events" className="mb-3 text-2xl font-extrabold">{t.mine.eventsTitle}</h2>
        {registrations.length === 0 ? (
          <p>{t.mine.noEvents}</p>
        ) : (
          <ul className="space-y-2">
            {registrations.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{r.event_title_en}</span>
                <span>{formatDateTime(r.event_date, r.event_time, "en")}</span>
                <Badge tone={r.status === "confirmed" ? "ok" : "neutral"}>{t.mine.eventStatuses[r.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {podcast && (
        <section aria-labelledby="podcast" className="mb-8">
          <h2 id="podcast" className="mb-3 text-2xl font-extrabold">{t.mine.podcastTitle}</h2>
          <p>
            <Badge>{t.podcast.statuses[podcast.status]}</Badge> {t.mine.podcastPage}
          </p>
        </section>
      )}

      <form action={signOut}>
        <button type="submit" className={buttonClass.small}>{t.digital.signOut}</button>
      </form>
    </>
  );
}
