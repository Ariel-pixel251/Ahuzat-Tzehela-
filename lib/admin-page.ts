import "server-only";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { audit } from "@/lib/db/misc";

/**
 * Start of every admin page: checks the signed-in admin on the server (the layout checks too),
 * and records the view in the audit log when the page shows personal details.
 */
export async function adminPage(view?: string) {
  const admin = await requireAdmin();
  const db = await getDb();
  if (view) await audit(db, admin.email, "view", view);
  return { admin, db };
}
