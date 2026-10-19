import type { Metadata } from "next";
import { joinPodcastAsResident } from "@/app/actions/residents";
import { Wizard } from "@/components/Wizard";
import { residentsText as t } from "@/lib/i18n";
import { podcastSteps } from "@/lib/wizard-steps";

export const metadata: Metadata = { title: t.pages.podcast.title };

export default function PodcastPage() {
  return (
    <>
      <h1 className="text-4xl font-extrabold">{t.pages.podcast.title}</h1>
      <p className="mb-6 mt-3 text-xl">{t.pages.podcast.intro}</p>
      <Wizard steps={podcastSteps} action={joinPodcastAsResident} done={t.confirm.podcast} />
    </>
  );
}
