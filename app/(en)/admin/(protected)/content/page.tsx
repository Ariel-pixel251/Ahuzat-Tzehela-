import type { Metadata } from "next";
import { addAnnouncement, addCourse, addSlot, deleteAnnouncement, deleteCourse, deleteSlot, toggleAnnouncement } from "@/app/actions/admin";
import { ActionButton } from "@/components/ActionButton";
import { AdminSection, CsvLink, Table } from "@/components/admin";
import { ActionForm, SelectField, TextField } from "@/components/forms";
import { PageTitle } from "@/components/ui";
import { getDb } from "@/lib/db/client";
import { listAnnouncements, listCourses, listSlots } from "@/lib/db/misc";

export const metadata: Metadata = { title: "Content" };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function AdminContent() {
  const db = await getDb();
  const [announcements, courses, slots] = await Promise.all([listAnnouncements(db), listCourses(db, false), listSlots(db)]);
  const he = (text: string | null) => <span lang="he" dir="rtl">{text}</span>;
  return (
    <>
      <PageTitle>Content</PageTitle>
      <AdminSection title="Announcement banner (both portals)" actions={<CsvLink dataset="announcements" />}>
        <Table
          head={["English", "Hebrew", "Expires", "Shown", ""]}
          rows={announcements.map((a) => [
            a.text_en,
            he(a.text_he),
            a.expires_on ?? "never",
            a.active ? "yes" : "no",
            <div key="a" className="flex gap-1">
              <ActionButton action={toggleAnnouncement} fields={{ id: a.id }} label={a.active ? "Turn off" : "Turn on"} variant="small" />
              <ActionButton action={deleteAnnouncement} fields={{ id: a.id }} label="Delete" variant="small" />
            </div>,
          ])}
        />
        <div className="mt-4 max-w-xl">
          <ActionForm action={addAnnouncement} submitLabel="Add announcement">
            <TextField name="text_en" label="Text in English" required multiline />
            <TextField name="text_he" label="Text in Hebrew" required multiline />
            <TextField name="expires_on" label="Show until (optional)" type="date" />
          </ActionForm>
        </div>
      </AdminSection>

      <AdminSection title="Recommended courses" actions={<CsvLink dataset="courses" />}>
        <Table
          head={["English", "Hebrew", ""]}
          rows={courses.map((c) => [
            <span key="e"><b>{c.title_en}</b><br />{c.description_en}</span>,
            <span key="h" lang="he" dir="rtl"><b>{c.title_he}</b><br />{c.description_he}</span>,
            <ActionButton key="d" action={deleteCourse} fields={{ id: c.id }} label="Delete" variant="small" />,
          ])}
        />
        <div className="mt-4 max-w-xl">
          <ActionForm action={addCourse} submitLabel="Add course">
            <TextField name="title_en" label="Title in English" required />
            <TextField name="title_he" label="Title in Hebrew" required />
            <TextField name="description_en" label="Description in English" multiline />
            <TextField name="description_he" label="Description in Hebrew" multiline />
          </ActionForm>
        </div>
      </AdminSection>

      <AdminSection title="Weekly timetable" actions={<CsvLink dataset="timetable" />}>
        <Table
          head={["Day", "Time", "English", "Hebrew", ""]}
          rows={slots.map((s) => [
            DAYS[s.day],
            `${s.start_time}${s.end_time ? `–${s.end_time}` : ""}`,
            `${s.title_en}${s.location_en ? ` · ${s.location_en}` : ""}`,
            he(`${s.title_he}${s.location_he ? ` · ${s.location_he}` : ""}`),
            <ActionButton key="d" action={deleteSlot} fields={{ id: s.id }} label="Delete" variant="small" />,
          ])}
        />
        <div className="mt-4 max-w-xl">
          <ActionForm action={addSlot} submitLabel="Add to timetable">
            <SelectField name="day" label="Day" options={DAYS.map((d, i) => ({ value: String(i), label: d }))} />
            <TextField name="start_time" label="Starts" type="time" required />
            <TextField name="end_time" label="Ends" type="time" />
            <TextField name="title_en" label="Title in English" required />
            <TextField name="title_he" label="Title in Hebrew" required />
            <TextField name="location_en" label="Place in English" />
            <TextField name="location_he" label="Place in Hebrew" />
          </ActionForm>
        </div>
      </AdminSection>
    </>
  );
}
