import type { Metadata } from "next";
import { PodcastPeople } from "@/components/students/PodcastPeople";
import { PodcastSignup } from "@/components/students/PodcastSignup";
import { PageTitle } from "@/components/ui";
import { listAllTimes, listLooking, placesLeft } from "@/lib/db/podcast";
import { studentsText as t } from "@/lib/i18n";
import { formatPodcastTime } from "@/lib/i18n/format";
import { tryDb } from "@/lib/server";

export const metadata: Metadata = { title: t.podcast.title };
export const dynamic = "force-dynamic";

export default async function PodcastPage() {
  const db = await tryDb();
  const [people, times] = db ? await Promise.all([listLooking(db), listAllTimes(db)]) : [[], []];
  const now = new Date();
  // open times that haven't started and still have places for students, soonest first
  const choices = times
    .filter((x) => x.open && x.starts_at > now && placesLeft(x, "student") > 0)
    .sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime())
    .map((x) => ({ value: x.id, label: formatPodcastTime(x, "en") }));
  const labels = Object.fromEntries(times.map((x) => [x.id, formatPodcastTime(x, "en")]));
  return (
    <>
      <PageTitle lead={t.podcast.lead}>{t.podcast.title}</PageTitle>
      <section aria-labelledby="signup" className="rounded-2xl bg-sand p-5">
        <h2 id="signup" className="mb-4 text-2xl font-extrabold">{t.podcast.signUpTitle}</h2>
        <PodcastSignup times={choices} />
      </section>
      <section aria-labelledby="looking" className="mt-10">
        <h2 id="looking" className="mb-4 text-2xl font-extrabold">{t.podcast.lookingTitle}</h2>
        <PodcastPeople people={people} times={labels} />
      </section>
    </>
  );
}
