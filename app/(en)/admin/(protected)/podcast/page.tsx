import type { Metadata } from "next";
import { cancelPodcastTimeAction, setPodcastTimeOpenAction, unpairPodcast } from "@/app/actions/admin";
import { ActionButton } from "@/components/ActionButton";
import { AdminSection, CsvLink, Table } from "@/components/admin";
import { PairForm, TimePairForm } from "@/components/admin/GroupForms";
import { PodcastTimeForm } from "@/components/admin/PodcastTimeForm";
import { Badge, PageTitle } from "@/components/ui";
import { languageName } from "@/config/languages";
import { optionLabel, PODCAST_TOPICS } from "@/config/options";
import { adminPage } from "@/lib/admin-page";
import { listAllTimes, listPairs, listParticipants, type Participant, type PodcastTime } from "@/lib/db/podcast";
import { formatPodcastTime } from "@/lib/i18n/format";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Podcast" };

/** Podcast times (like digital support slots): who chose each, who is paired, and the controls. */
export default async function AdminPodcast() {
  const { db } = await adminPage("podcast");
  const [people, pairs, times] = await Promise.all([listParticipants(db), listPairs(db), listAllTimes(db)]);
  const now = new Date();
  const upcoming = times.filter((x) => x.starts_at > now).sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());
  const past = times.filter((x) => x.starts_at <= now).slice(0, 20);
  const timeLabel = (id: string | null | undefined) => {
    const x = id ? times.find((t) => t.id === id) : null;
    return x ? formatPodcastTime(x, "en") : null;
  };
  const partnerOf = (p: Participant) => {
    const pair = p.pair_id ? pairs.find((x) => x.pair_id === p.pair_id) : null;
    return pair?.members.find((m) => m.id !== p.id)?.name ?? null;
  };
  const active = people.filter((p) => p.active);
  const unpaired = active.filter((p) => !p.pair_id);

  const personLine = (p: Participant) => {
    const partner = partnerOf(p);
    return (
      <li key={p.id}>
        {p.name} <span className="text-sm">({languageName(p.language, "en")})</span>{" "}
        {partner ? <Badge tone="ok">paired with {partner}</Badge> : <Badge tone="warn">not paired</Badge>}
      </li>
    );
  };

  const timeCard = (x: PodcastTime) => {
    const here = active.filter((p) => p.time_id === x.id);
    const residents = here.filter((p) => p.portal === "resident");
    const students = here.filter((p) => p.portal === "student");
    const free = (list: Participant[]) => list.filter((p) => !p.pair_id).map((p) => ({ id: p.id, label: p.name }));
    const scheduled = x.status === "scheduled" && x.starts_at > now;
    const auto = x.resident_places === 1 && x.student_places === 1;
    return (
      <li key={x.id} className="rounded-2xl border-2 border-line p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-extrabold">{formatPodcastTime(x, "en")}</h3>
          {x.status === "cancelled" ? <Badge tone="bad">Cancelled</Badge> : x.open ? <Badge tone="ok">Open</Badge> : <Badge tone="warn">Closed</Badge>}
          <Badge tone={x.residents >= x.resident_places ? "warn" : "neutral"}>Residents {x.residents}/{x.resident_places}</Badge>
          <Badge tone={x.students >= x.student_places ? "warn" : "neutral"}>Students {x.students}/{x.student_places}</Badge>
          {auto && <Badge>Pairs automatically</Badge>}
        </div>
        {scheduled && (
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton action={setPodcastTimeOpenAction} fields={{ id: x.id, open: x.open ? "no" : "yes" }} label={x.open ? "Close" : "Open"} variant="small" />
            <ActionButton action={cancelPodcastTimeAction} fields={{ id: x.id }} label="Cancel (tells everyone signed up)" variant="small" />
          </div>
        )}
        {x.status === "scheduled" && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="font-bold">Residents</h4>
              {residents.length ? <ul className="mt-1 space-y-1">{residents.map(personLine)}</ul> : <p>Nobody yet.</p>}
            </div>
            <div>
              <h4 className="font-bold">Students</h4>
              {students.length ? <ul className="mt-1 space-y-1">{students.map(personLine)}</ul> : <p>Nobody yet.</p>}
            </div>
          </div>
        )}
        {x.status === "scheduled" && free(residents).length > 0 && free(students).length > 0 && (
          <details className="mt-3 rounded-xl border-2 border-line p-3">
            <summary className="cursor-pointer font-bold">Pair people at this time</summary>
            <div className="mt-3">
              <TimePairForm timeId={x.id} residents={free(residents)} students={free(students)} />
            </div>
          </details>
        )}
      </li>
    );
  };

  return (
    <>
      <PageTitle>Podcast</PageTitle>
      <AdminSection title="Podcast times">
        <p className="mb-3">
          Residents and students pick one of these times. A time with 1 place for residents and 1 for students pairs the two
          automatically; with more places, pair the people who chose it here. Cancelling a time tells everyone who chose it.
        </p>
        <details className="mb-4 rounded-xl border-2 border-line p-4">
          <summary className="cursor-pointer font-bold">Add a podcast time (once or weekly)</summary>
          <div className="mt-4">
            <PodcastTimeForm />
          </div>
        </details>
        {upcoming.length ? <ul className="space-y-4">{upcoming.map(timeCard)}</ul> : <p>No upcoming podcast times. Residents and students can&apos;t sign up until you add one.</p>}
        {past.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer font-bold">Past times</summary>
            <ul className="mt-3 space-y-4">{past.map(timeCard)}</ul>
          </details>
        )}
      </AdminSection>
      <AdminSection title="Make a pair (anyone)">
        <p className="mb-3">Pair anyone still waiting, or type in someone who hasn&apos;t signed up.</p>
        <PairForm
          people={unpaired.map((p) => {
            const time = timeLabel(p.time_id);
            return { id: p.id, label: `${p.name} (${p.portal}, ${time ?? "no time chosen"})` };
          })}
        />
      </AdminSection>
      <AdminSection title="Pairs">
        <Table
          head={["Members", "Created", ""]}
          rows={pairs.map((p) => [
            p.members.map((m) => `${m.name} (${m.portal})`).join(" + "),
            [
              `${p.created_at.toISOString().slice(0, 10)} by ${p.created_by}`,
              p.meeting_date ? `meets ${p.meeting_date}${p.meeting_time ? ` ${p.meeting_time}` : ""}${p.meeting_place ? `, ${p.meeting_place}` : ""}` : "",
            ].filter(Boolean).join(" · "),
            <ActionButton key="u" action={unpairPodcast} fields={{ id: p.pair_id }} label="Unpair" variant="small" />,
          ])}
          empty="No pairs yet."
        />
      </AdminSection>
      <AdminSection title="Everyone signed up" actions={<CsvLink dataset="podcast" />}>
        <Table
          head={["Name", "Portal", "Contact", "Topic", "Language", "Time", "Status"]}
          rows={people.map((p) => [
            p.name,
            p.portal,
            <span key="c" dir="ltr">{[p.email, formatPhone(p.phone)].filter(Boolean).join(" · ")}</span>,
            p.topics.length ? p.topics.map((t) => optionLabel(PODCAST_TOPICS, t, "en")).join(", ") : "—",
            languageName(p.language, "en"),
            timeLabel(p.time_id) ?? "No time chosen",
            <Badge key="s" tone={p.status === "paired" ? "ok" : p.active ? "warn" : "neutral"}>{p.active ? (p.pair_id ? "paired" : "waiting") : "left"}</Badge>,
          ])}
        />
      </AdminSection>
    </>
  );
}
