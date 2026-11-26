import type { Metadata } from "next";
import { leavePodcast } from "@/app/actions/students";
import { ActionButton } from "@/components/ActionButton";
import { Card, Notice, PageTitle } from "@/components/ui";
import { getParticipantByToken, getPodcastTime } from "@/lib/db/podcast";
import { studentsText as t } from "@/lib/i18n";
import { formatPodcastTime } from "@/lib/i18n/format";
import { tryDb } from "@/lib/server";
import { v } from "@/lib/validation";

export const metadata: Metadata = { title: t.podcast.cancelTitle, robots: { index: false } };
export const dynamic = "force-dynamic";

/** The cancel link from the podcast email: opening it changes nothing; the button (a POST) cancels. */
export default async function CancelPodcastPlace({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const parsed = v.token.safeParse((await searchParams).token);
  const db = await tryDb();
  const me = db && parsed.success ? await getParticipantByToken(db, parsed.data) : null;
  if (!parsed.success || !db || !me || !me.active) return <Notice kind="bad">{t.podcast.invalid}</Notice>;
  const time = me.time_id ? await getPodcastTime(db, me.time_id) : null;
  return (
    <>
      <PageTitle>{t.podcast.cancelTitle}</PageTitle>
      {time && (
        <Card className="mb-6">
          <p className="text-xl font-extrabold">{formatPodcastTime(time, "en")}</p>
        </Card>
      )}
      <ActionButton action={leavePodcast} fields={{ token: parsed.data }} label={t.podcast.cancel} variant="danger" />
    </>
  );
}
