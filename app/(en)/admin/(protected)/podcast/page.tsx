import type { Metadata } from "next";
import { pairPodcast, unpairPodcast } from "@/app/actions/admin";
import { ActionButton } from "@/components/ActionButton";
import { AdminSection, CsvLink, Table } from "@/components/admin";
import { InlineForm } from "@/components/forms";
import { Badge, PageTitle } from "@/components/ui";
import { languageName } from "@/config/languages";
import { optionLabel, PODCAST_TOPICS } from "@/config/options";
import { getDb } from "@/lib/db/client";
import { listAllPendingRequests, listPairs, listParticipants } from "@/lib/db/podcast";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Podcast pairs" };

export default async function AdminPodcast() {
  const db = await getDb();
  const [people, pairs, pending] = await Promise.all([listParticipants(db), listPairs(db), listAllPendingRequests(db)]);
  const unpaired = people.filter((p) => p.active && p.status !== "paired");
  const select = (name: string, label: string) => (
    <label className="flex items-center gap-2">
      <span className="text-sm font-bold">{label}</span>
      <select name={name} className="min-h-10 rounded border-2 border-ink px-2" required>
        <option value="">Choose…</option>
        {unpaired.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.portal})</option>)}
      </select>
    </label>
  );
  return (
    <>
      <PageTitle>Podcast pairs</PageTitle>
      <AdminSection title="Make a pair">
        <InlineForm action={pairPodcast} submitLabel="Pair them">
          {select("a", "Person 1")}
          {select("b", "Person 2")}
        </InlineForm>
      </AdminSection>
      <AdminSection title="Pair requests waiting for an answer">
        <Table
          head={["From", "To", "Since", ""]}
          rows={pending.map((r) => [
            r.from_name,
            r.to_name,
            r.created_at.toISOString().slice(0, 10),
            <ActionButton key="a" action={pairPodcast} fields={{ a: r.from_id, b: r.to_id }} label="Accept on their behalf" variant="small" />,
          ])}
          empty="No open requests."
        />
      </AdminSection>
      <AdminSection title="Pairs">
        <Table
          head={["Members", "Created", ""]}
          rows={pairs.map((p) => [
            p.members.map((m) => `${m.name} (${m.portal})`).join(" + "),
            `${p.created_at.toISOString().slice(0, 10)} by ${p.created_by}`,
            <ActionButton key="u" action={unpairPodcast} fields={{ id: p.pair_id }} label="Unpair" variant="small" />,
          ])}
          empty="No pairs yet."
        />
      </AdminSection>
      <AdminSection title="Everyone signed up" actions={<CsvLink dataset="podcast" />}>
        <Table
          head={["Name", "Portal", "Contact", "Topics", "Language", "Availability", "Status"]}
          rows={people.map((p) => [
            p.name,
            p.portal,
            <span key="c" dir="ltr">{[p.email, formatPhone(p.phone)].filter(Boolean).join(" · ")}</span>,
            p.topics.map((t) => optionLabel(PODCAST_TOPICS, t, "en")).join(", "),
            languageName(p.language, "en"),
            p.availability ?? "",
            <Badge key="s" tone={p.status === "paired" ? "ok" : p.active ? "warn" : "neutral"}>{p.active ? p.status : "left"}</Badge>,
          ])}
        />
      </AdminSection>
    </>
  );
}
