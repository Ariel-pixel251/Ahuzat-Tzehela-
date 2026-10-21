import { createHash, timingSafeEqual } from "node:crypto";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Constant-time check of "Authorization: Bearer $CRON_SECRET" (the secret may be given in several spellings). */
export function cronAuthorized(header: string | null, secrets: (string | undefined)[]) {
  const given = digest(header ?? "");
  let ok = false;
  for (const s of secrets) {
    if (s && timingSafeEqual(given, digest(`Bearer ${s}`))) ok = true;
  }
  return ok;
}
