import type { Metadata } from "next";
import { answerPairRequest, askToPair, leavePodcast } from "@/app/actions/students";
import { ActionButton } from "@/components/ActionButton";
import { PodcastPeople } from "@/components/students/PodcastPeople";
import { Badge, Card, Notice, PageTitle } from "@/components/ui";
import { getParticipantByToken, getPartner, listAllTimes, listLooking, listPendingRequests } from "@/lib/db/podcast";
import { formatPodcastTime } from "@/lib/i18n/format";
import { studentsText as t } from "@/lib/i18n";
import { formatPhone } from "@/lib/phone";
import { tryDb } from "@/lib/server";
import { v } from "@/lib/validation";

export const metadata: Metadata = { title: t.podcast.manageTitle, robots: { index: false } };
export const dynamic = "force-dynamic";

/** Private podcast page (link emailed at sign-up): request a partner, answer requests. */
export default async function PodcastManage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const parsed = v.token.safeParse((await searchParams).token);
  const db = await tryDb();
  const me = db && parsed.success ? await getParticipantByToken(db, parsed.data) : null;
  if (!db || !me || !me.active || !parsed.success) return <Notice kind="bad">{t.podcast.invalid}</Notice>;
  const token = parsed.data;
  const [partner, requests, looking, times] = await Promise.all([getPartner(db, me.id), listPendingRequests(db, me.id), listLooking(db), listAllTimes(db)]);
  const labels = Object.fromEntries(times.map((x) => [x.id, formatPodcastTime(x, "en")]));
  const others = looking.filter((p) => p.id !== me.id);
  const outgoing = new Set(requests.filter((r) => r.direction === "out").map((r) => r.other_id));
  return (
    <>
      <PageTitle>{t.podcast.manageTitle}</PageTitle>
      <Card className="mb-6">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{t.podcast.you}: {me.name}</span>
          <Badge tone={me.status === "paired" ? "ok" : "neutral"}>{t.podcast.statuses[me.status]}</Badge>
        </p>
        {me.time_id && labels[me.time_id] && <p className="mt-2">{t.podcast.yourTime}: {labels[me.time_id]}</p>}
        {partner ? (
          <div className="mt-3">
            <h2 className="text-xl font-extrabold">{t.podcast.partner}: {partner.name}</h2>
            <p dir="ltr" className="text-start">{[partner.email, formatPhone(partner.phone)].filter(Boolean).join(" · ")}</p>
          </div>
        ) : (
          <p className="mt-3">{t.podcast.noPartner}</p>
        )}
      </Card>

      {!partner && requests.length > 0 && (
        <ul className="mb-6 space-y-3">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-line p-4">
              <span className="font-bold">{r.other_first_name}</span>
              <span>{r.direction === "in" ? t.podcast.incoming : t.podcast.outgoing}</span>
              {r.direction === "in" && (
                <span className="flex gap-2">
                  <ActionButton action={answerPairRequest} fields={{ token, request: r.id, accept: "yes" }} label={t.podcast.accept} />
                  <ActionButton action={answerPairRequest} fields={{ token, request: r.id, accept: "no" }} label={t.podcast.decline} variant="secondary" />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {!partner && (
        <section aria-labelledby="looking">
          <h2 id="looking" className="mb-4 text-2xl font-extrabold">{t.podcast.lookingTitle}</h2>
          <PodcastPeople
            people={others}
            times={labels}
            action={(p) =>
              outgoing.has(p.id) ? (
                <p className="mt-2 font-bold">{t.podcast.outgoing}</p>
              ) : (
                <div className="mt-3">
                  <ActionButton action={askToPair} fields={{ token, target: p.id }} label={t.podcast.request} />
                </div>
              )
            }
          />
        </section>
      )}

      <div className="mt-10">
        <ActionButton action={leavePodcast} fields={{ token }} label={t.podcast.leave} variant="danger" />
      </div>
    </>
  );
}
