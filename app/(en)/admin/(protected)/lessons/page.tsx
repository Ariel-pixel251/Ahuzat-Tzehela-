import type { Metadata } from "next";
import { addLessonTopic, matchLesson, toggleLessonTopic, unmatchLesson } from "@/app/actions/admin";
import { ActionButton } from "@/components/ActionButton";
import { AdminSection, CsvLink, Table } from "@/components/admin";
import { ActionForm, InlineForm, TextField } from "@/components/forms";
import { Badge, PageTitle } from "@/components/ui";
import { getDb } from "@/lib/db/client";
import { listLessonMatches, listLessonRequests, listLessonTopics } from "@/lib/db/misc";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Private lessons" };

export default async function AdminLessons() {
  const db = await getDb();
  const [topics, requests, matches] = await Promise.all([listLessonTopics(db, false), listLessonRequests(db), listLessonMatches(db)]);
  const topicName = (id: string) => topics.find((t) => t.id === id)?.name_en ?? id;
  const learners = requests.filter((r) => r.role === "learn");
  const teachers = requests.filter((r) => r.role === "teach");
  const byId = new Map(requests.map((r) => [r.id, r]));
  const describe = (r: (typeof requests)[number]) => [...r.topics.map(topicName), r.other_topic].filter(Boolean).join(", ");
  return (
    <>
      <PageTitle>Private lessons</PageTitle>
      <AdminSection title="Suggested matches (same topic)">
        <Table
          head={["Learner (resident)", "Wants", "Possible teachers", "Match"]}
          rows={learners
            .filter((l) => l.status === "open")
            .map((l) => {
              const candidates = teachers.filter((t) => t.topics.some((x) => l.topics.includes(x)));
              const pool = candidates.length ? candidates : teachers;
              return [
                l.name,
                describe(l),
                candidates.map((c) => c.name).join(", ") || <span key="n" className="text-muted">none with the same topic</span>,
                <InlineForm key="m" action={matchLesson} submitLabel="Match">
                  <input type="hidden" name="learner" value={l.id} />
                  <label className="sr-only" htmlFor={`t-${l.id}`}>Teacher</label>
                  <select id={`t-${l.id}`} name="teacher" required className="min-h-10 rounded border-2 border-ink px-2">
                    {pool.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <input type="hidden" name="topic" value={l.topics.map(topicName).join(", ") || (l.other_topic ?? "")} />
                </InlineForm>,
              ];
            })}
          empty="No learners waiting."
        />
      </AdminSection>
      <AdminSection title="Matches">
        <Table
          head={["Learner", "Teacher", "Topic", ""]}
          rows={matches.map((m) => [
            byId.get(m.learner_id)?.name ?? "",
            byId.get(m.teacher_id)?.name ?? "",
            m.topic ?? "",
            <ActionButton key="u" action={unmatchLesson} fields={{ id: m.id }} label="Unmatch" variant="small" />,
          ])}
        />
      </AdminSection>
      <AdminSection title="All lesson requests" actions={<CsvLink dataset="lessons" />}>
        <Table
          head={["Name", "Role", "Contact", "Topics", "Status", "Code"]}
          rows={requests.map((r) => [
            r.name,
            r.role === "learn" ? "wants to learn" : "can teach",
            <span key="c" dir="ltr">{[r.email, formatPhone(r.phone)].filter(Boolean).join(" · ")}</span>,
            describe(r),
            <Badge key="s">{r.status}</Badge>,
            r.code,
          ])}
        />
      </AdminSection>
      <AdminSection title="Lesson topics">
        <Table
          head={["English", "Hebrew", "Shown", ""]}
          rows={topics.map((t) => [
            t.name_en,
            <span key="h" lang="he" dir="rtl">{t.name_he}</span>,
            t.active ? "yes" : "no",
            <ActionButton key="t" action={toggleLessonTopic} fields={{ id: t.id }} label={t.active ? "Hide" : "Show"} variant="small" />,
          ])}
        />
        <div className="mt-4 max-w-md">
          <ActionForm action={addLessonTopic} submitLabel="Add topic">
            <TextField name="name_en" label="Topic in English" required />
            <TextField name="name_he" label="Topic in Hebrew" required />
          </ActionForm>
        </div>
      </AdminSection>
    </>
  );
}
