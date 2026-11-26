import type { Metadata } from "next";
import { PodcastTimeSignUp } from "@/components/students/CardSignUp";
import { Badge, Notice, PageTitle } from "@/components/ui";
import { listOpenTimes, placesLeft } from "@/lib/db/podcast";
import { sharedText, studentsText as t } from "@/lib/i18n";
import { formatSlotWhen } from "@/lib/i18n/format";
import { tryDb } from "@/lib/server";

export const metadata: Metadata = { title: t.podcast.title };
export const dynamic = "force-dynamic";

/** The team's open podcast times with places left for students; sign up right on the card. */
export default async function PodcastPage() {
  const db = await tryDb();
  if (!db) return <Notice kind="warn">{sharedText.en.errors.unavailable}</Notice>;
  const times = await listOpenTimes(db, "student");
  return (
    <>
      <PageTitle lead={t.podcast.lead}>{t.podcast.title}</PageTitle>
      {times.length === 0 ? (
        <p>{t.podcast.none}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {times.map((x) => {
            const when = formatSlotWhen({ ...x, slot_date: x.time_date }, "en");
            return (
              <li key={x.id} className="rounded-2xl border-2 border-line p-4">
                <h2 className="text-xl font-extrabold">{when}</h2>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="font-bold">{t.podcast.place}</dt>
                  <dd>{x.place_en ?? x.place_he}</dd>
                </dl>
                <p className="mt-2">
                  <Badge tone="ok">{t.podcast.placesLeft(placesLeft(x, "student"))}</Badge>
                </p>
                <div className="mt-3">
                  <PodcastTimeSignUp timeId={x.id} label={when} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
