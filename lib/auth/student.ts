import "server-only";
import { cookies } from "next/headers";
import { getStudentBySession } from "@/lib/db/students";
import type { Db } from "@/lib/db/types";

export const STUDENT_COOKIE = "student_session";

/** The signed-in student (magic-link session cookie), or null. */
export async function currentStudent(db: Db) {
  const token = (await cookies()).get(STUDENT_COOKIE)?.value;
  return token ? getStudentBySession(db, token) : null;
}
