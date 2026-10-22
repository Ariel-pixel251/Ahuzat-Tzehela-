import type { Metadata } from "next";
import { deletePodcastTimeAction, pairPodcast, setPodcastTimeOpenAction, unpairPodcast } from "@/app/actions/admin";
import { ActionButton } from "@/components/ActionButton";
import { AdminSection, CsvLink, Table } from "@/components/admin";
import { PairForm } from "@/components/admin/GroupForms";
import { PodcastTimeForm } from "@/components/admin/PodcastTimeForm";
import { Badge, PageTitle } from "@/components/ui";
import { languageName } from "@/config/languages";
import { optionLabel, PODCAST_TOPICS } from "@/config/options";
import { adminPage } from "@/lib/admin-page";
import { listAllPendingRequests, listAllTimes, listPairs, listParticipants } from "@/lib/db/podcast";
import { formatPodcastTime } from "@/lib/i18n/format";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Podcast pairs" };

export default async function AdminPodcast() {
  const { db } = await adminPage("podcast");
  const [people, pairs, pending, times] = await Promise.all([listParticipants(db), listPairs(db), listAllPendingRequests(db), listAllTimes(db)]);
  const unpaired = people.filter((p) => p.active && p.status !== "paired");
  const now = new Date();
  const upcoming = times.filter((x) => x.starts_at > now).sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());
  const timeLabel = (id: string | null | undefined) => {
    const x = id ? times.find((t) => t.id === id) : null;
    return x ? formatPodcastTime(x, "en") : null;
  };
  return (
    <>
      <PageTitle>Podcast pairs</PageTitle>
      <AdminSection title="Podcast times">
        <p className="mb-3">
          Residents and students choose one of these times when they sign up (or &quot;arrange by message&quot;). A time is full for
          residents once as many residents as pairs chose it, and the same for students. Pair two people who chose the same time,
          and their meeting is set to it.
        </p>
        <Table
          head={["When and where", "Residents", "Students", ""]}
          rows={upcoming.map((x) => [
            <span key="w">
              {formatPodcastTime(x, "en")} {!x.open && <Badge tone="warn">closed</Badge>}
            </span>,
            `${x.residents} of ${x.pairs}`,
            `${x.students} of ${x.pairs}`,
            <span key="a" className="flex flex-wrap gap-2">
              <ActionButton action={setPodcastTimeOpenAction} fields={{ id: x.id, open: x.open ? "no" : "yes" }} label={x.open ? "Close" : "Open"} variant="small" />
              <ActionButton action={deletePodcastTimeAction} fields={{ id: x.id }} label="Delete" variant="small" />
            </span>,
          ])}
          empty="No upcoming podcast times. Residents and students can only choose 'arrange by message'."
        />
        <details className="mt-4 rounded-xl border-2 border-line p-4">
          <summary className="cursor-pointer font-bold">Add a podcast time</summary>
          <div className="mt-4">
            <PodcastTimeForm />
          </div>
        </details>
      </AdminSection>
      <AdminSection title="Make a pair">
        <p className="mb-3">Pair anyone on the list, or type in someone who hasn&apos;t signed up.</p>
        <PairForm
          people={unpaired.map((p) => {
            const time = timeLabel(p.time_id);
            return { id: p.id, label: `${p.name} (${p.portal}${time ? `, ${time}` : ""})` };
          })}
        />
      </AdminSection>
      <AdminSection title="Pair requests waiting for an answer">
        <Table
          head={["From", "To", "Since", ""]}
          rows={pending.map((r) => [
            r.from_name,
            r.to_name,
            r.created_at.toISOString().slice(0, 10),
            <ActionButton key="a" action={pairPodcast} fields={{ a: r.from_id, b: r.to_id, notify: "on" }} label="Accept on their behalf" variant="small" />,
          ])}
          empty="No open requests."
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
          head={["Name", "Portal", "Contact", "Topics", "Language", "Time", "Status"]}
          rows={people.map((p) => [
            p.name,
            p.portal,
            <span key="c" dir="ltr">{[p.email, formatPhone(p.phone)].filter(Boolean).join(" · ")}</span>,
            p.topics.map((t) => optionLabel(PODCAST_TOPICS, t, "en")).join(", "),
            languageName(p.language, "en"),
            timeLabel(p.time_id) ?? p.availability ?? "Arrange by message",
            <Badge key="s" tone={p.status === "paired" ? "ok" : p.active ? "warn" : "neutral"}>{p.active ? p.status : "left"}</Badge>,
          ])}
        />
      </AdminSection>
    </>
  );
}
