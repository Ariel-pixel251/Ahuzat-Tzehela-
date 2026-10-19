import type { Metadata } from "next";
import { PodcastPeople } from "@/components/students/PodcastPeople";
import { PodcastSignup } from "@/components/students/PodcastSignup";
import { PageTitle } from "@/components/ui";
import { listLooking } from "@/lib/db/podcast";
import { studentsText as t } from "@/lib/i18n";
import { tryDb } from "@/lib/server";

export const metadata: Metadata = { title: t.podcast.title };
export const dynamic = "force-dynamic";

export default async function PodcastPage() {
  const db = await tryDb();
  const people = db ? await listLooking(db) : [];
  return (
    <>
      <PageTitle lead={t.podcast.lead}>{t.podcast.title}</PageTitle>
      <section aria-labelledby="signup" className="rounded-2xl bg-sand p-5">
        <h2 id="signup" className="mb-4 text-2xl font-extrabold">{t.podcast.signUpTitle}</h2>
        <PodcastSignup />
      </section>
      <section aria-labelledby="looking" className="mt-10">
        <h2 id="looking" className="mb-4 text-2xl font-extrabold">{t.podcast.lookingTitle}</h2>
        <PodcastPeople people={people} />
      </section>
    </>
  );
}
