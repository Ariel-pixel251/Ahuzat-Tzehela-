import type { Metadata } from "next";
import { cancelPodcastByToken, joinPodcastAsResident } from "@/app/actions/residents";
import { SignUp } from "@/components/residents/SignUp";
import { Notice } from "@/components/ui";
import { listUpcomingTimes } from "@/lib/db/podcast";
import { residentsText as t, sharedText } from "@/lib/i18n";
import { podcastChoices, podcastExtras } from "@/lib/resident-signup";
import { tryDb } from "@/lib/server";

export const metadata: Metadata = { title: t.pages.podcast.title };
export const dynamic = "force-dynamic";

/** Join the podcast: pick one of the team's times, then name and phone (and the language). */
export default async function PodcastPage() {
  const db = await tryDb();
  return (
    <>
      <h1 className="text-4xl font-extrabold">{t.pages.podcast.title}</h1>
      <p className="mb-6 mt-3 text-xl">{t.pages.podcast.intro}</p>
      {!db ? (
        <Notice kind="warn" className="text-xl">{sharedText.he.errors.unavailable}</Notice>
      ) : (
        <SignUp
          slots={podcastChoices(await listUpcomingTimes(db))}
          slotField="time"
          extras={podcastExtras}
          action={joinPodcastAsResident}
          cancelAction={cancelPodcastByToken}
        />
      )}
    </>
  );
}
