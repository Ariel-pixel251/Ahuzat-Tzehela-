"use server";

import { getEvent, getProject } from "@/lib/data";
import { getSupabase } from "@/lib/supabase";

export type FormState = { ok: boolean; message: string } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(formData: FormData, name: string, max = 500): string {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

async function insert(table: string, row: Record<string, unknown>): Promise<FormState> {
  const supabase = getSupabase();
  if (!supabase) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[dev] Supabase לא מוגדר – ${table}:`, row);
      return { ok: true, message: "נרשם (מצב פיתוח – לא נשמר במסד הנתונים)." };
    }
    return { ok: false, message: "ההרשמה אינה זמינה כרגע. נסו שוב מאוחר יותר." };
  }
  const { error } = await supabase.from(table).insert(row);
  if (error) {
    console.error(`Supabase insert into ${table} failed:`, error.message);
    return { ok: false, message: "אירעה שגיאה בשמירה. נסו שוב." };
  }
  return { ok: true, message: "תודה! ההרשמה התקבלה, ניצור איתכם קשר." };
}

/** בודק פרטי קשר משותפים לכל הטפסים. מחזיר הודעת שגיאה או את הפרטים. */
function contact(formData: FormData): { error?: string; person?: { full_name: string; email: string; phone: string | null } } {
  const full_name = field(formData, "full_name", 100);
  const email = field(formData, "email", 200).toLowerCase();
  const phone = field(formData, "phone", 30) || null;
  if (!full_name) return { error: "נא למלא שם מלא." };
  if (!EMAIL_RE.test(email)) return { error: "נא למלא כתובת מייל תקינה." };
  return { person: { full_name, email, phone } };
}

export async function submitSignup(_prev: FormState, formData: FormData): Promise<FormState> {
  // שדה מלכודת לבוטים – משתמשים אמיתיים לא רואים אותו
  if (field(formData, "website")) return { ok: true, message: "תודה!" };

  const checked = contact(formData);
  if (!checked.person) return { ok: false, message: checked.error ?? "פרטים חסרים." };
  const { person } = checked;

  const kind = field(formData, "kind");
  const notes = field(formData, "notes", 1000) || null;

  if (kind === "project") {
    const project = getProject(field(formData, "target"));
    if (!project) return { ok: false, message: "נא לבחור פרויקט." };
    return insert("signups", { ...person, kind, project_slug: project.slug, notes });
  }

  if (kind === "event") {
    const event = getEvent(field(formData, "target"));
    if (!event) return { ok: false, message: "נא לבחור אירוע." };
    return insert("signups", { ...person, kind, event_id: event.id, notes });
  }

  if (kind === "lesson") {
    const topic = field(formData, "topic", 200);
    const role = field(formData, "role");
    if (!topic) return { ok: false, message: "נא לכתוב נושא לשיעור." };
    if (role !== "learn" && role !== "teach") return { ok: false, message: "נא לבחור אם ללמד או ללמוד." };
    return insert("signups", { ...person, kind, lesson_topic: topic, lesson_role: role, notes });
  }

  if (kind === "lecture") {
    const title = field(formData, "title", 200);
    if (!title) return { ok: false, message: "נא לכתוב נושא להרצאה." };
    return insert("lecture_proposals", {
      ...person,
      title,
      language: field(formData, "language", 50) || null,
      description: notes,
    });
  }

  return { ok: false, message: "סוג הרשמה לא מוכר." };
}
