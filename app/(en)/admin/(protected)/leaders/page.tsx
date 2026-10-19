import type { Metadata } from "next";
import { addLeader, addTask, deleteLeader, deleteTask, setTaskStatus } from "@/app/actions/admin";
import { ActionButton } from "@/components/ActionButton";
import { AdminSection, CsvLink, Table } from "@/components/admin";
import { ActionForm, SelectField, TextField } from "@/components/forms";
import { Badge, PageTitle } from "@/components/ui";
import { optionLabel, PROJECTS } from "@/config/options";
import { getDb } from "@/lib/db/client";
import { listLeaders, listTasks } from "@/lib/db/leaders";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Leaders and tasks" };

const projects = PROJECTS.map((p) => ({ value: p.code, label: p.en }));

export default async function AdminLeaders() {
  const db = await getDb();
  const [leaders, tasks] = await Promise.all([listLeaders(db), listTasks(db)]);
  return (
    <>
      <PageTitle>Leaders and tasks</PageTitle>
      <AdminSection title="Leaders" actions={<CsvLink dataset="leaders" />}>
        <Table
          head={["Name", "Phone", "Email", "Responsible for", ""]}
          rows={leaders.map((l) => [
            l.name,
            <span key="p" dir="ltr">{formatPhone(l.phone)}</span>,
            l.email ?? "",
            optionLabel(PROJECTS, l.project, "en"),
            <ActionButton key="d" action={deleteLeader} fields={{ id: l.id }} label="Remove" variant="small" />,
          ])}
        />
        <div className="mt-4 max-w-md">
          <ActionForm action={addLeader} submitLabel="Add leader">
            <TextField name="name" label="Name" required />
            <TextField name="phone" label="Phone" type="tel" />
            <TextField name="email" label="Email" type="email" />
            <SelectField name="project" label="Responsible for" options={projects} />
          </ActionForm>
        </div>
      </AdminSection>
      <AdminSection title="Tasks" actions={<CsvLink dataset="tasks" />}>
        <Table
          head={["Task", "Project", "Leader", "Due", "Status", ""]}
          rows={tasks.map((t) => [
            t.title,
            optionLabel(PROJECTS, t.project, "en"),
            t.leader_name ?? "–",
            t.due_on ?? "",
            <Badge key="s" tone={t.status === "done" ? "ok" : t.status === "doing" ? "warn" : "neutral"}>{t.status}</Badge>,
            <div key="a" className="flex flex-wrap gap-1">
              {(["todo", "doing", "done"] as const)
                .filter((s) => s !== t.status)
                .map((s) => <ActionButton key={s} action={setTaskStatus} fields={{ id: t.id, status: s }} label={s} variant="small" />)}
              <ActionButton action={deleteTask} fields={{ id: t.id }} label="Delete" variant="small" />
            </div>,
          ])}
        />
        <div className="mt-4 max-w-md">
          <ActionForm action={addTask} submitLabel="Add task">
            <TextField name="title" label="Task" required />
            <SelectField name="project" label="Project" options={projects} />
            <SelectField name="leader_id" label="Leader" options={[{ value: "", label: "(nobody yet)" }, ...leaders.map((l) => ({ value: l.id, label: l.name }))]} />
            <TextField name="due_on" label="Due date" type="date" />
          </ActionForm>
        </div>
      </AdminSection>
    </>
  );
}
