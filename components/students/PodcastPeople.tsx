import { Badge } from "@/components/ui";
import { languageName } from "@/config/languages";
import { optionLabel, PODCAST_TOPICS } from "@/config/options";
import { splitTitle } from "@/lib/calendar/parse";
import type { PublicParticipant } from "@/lib/db/podcast";
import { studentsText as t } from "@/lib/i18n";

/** The "looking for a partner" list: first names and interests only, never contact details. */
export function PodcastPeople({ people, action }: { people: PublicParticipant[]; action?: (p: PublicParticipant) => React.ReactNode }) {
  if (!people.length) return <p>{t.podcast.lookingNone}</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {people.map((p) => (
        <li key={p.id} className="rounded-2xl border-2 border-line p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold">{p.first_name}</h3>
            <Badge>{t.podcast.portals[p.portal]}</Badge>
            <Badge tone={p.status === "requested" ? "warn" : "neutral"}>{t.podcast.statuses[p.status]}</Badge>
          </div>
          <p className="mt-1">{p.topics.map((c) => optionLabel(PODCAST_TOPICS, c, "en")).join(", ")}</p>
          <p className="text-muted">
            {languageName(p.language, "en")}
            {p.availability ? ` · ${splitTitle(p.availability).en}` : ""}
          </p>
          {action?.(p)}
        </li>
      ))}
    </ul>
  );
}
