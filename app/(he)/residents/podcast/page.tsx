import type { Metadata } from "next";
import { joinPodcastAsResident } from "@/app/actions/residents";
import { Wizard } from "@/components/Wizard";
import { listUpcomingTimes } from "@/lib/db/podcast";
import { residentsText as t } from "@/lib/i18n";
import { tryDb } from "@/lib/server";
import { podcastSteps } from "@/lib/wizard-steps";

export const metadata: Metadata = { title: t.pages.podcast.title };
export const dynamic = "force-dynamic";

export default async function PodcastPage() {
  const db = await tryDb();
  const times = db ? await listUpcomingTimes(db) : [];
  return (
    <>
      <h1 className="text-4xl font-extrabold">{t.pages.podcast.title}</h1>
      <p className="mb-6 mt-3 text-xl">{t.pages.podcast.intro}</p>
      <Wizard steps={podcastSteps(times)} action={joinPodcastAsResident} done={t.confirm.podcast} doneDetail="slot" />
    </>
  );
}
