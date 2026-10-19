import { createHash, randomBytes, randomInt } from "node:crypto";

/** A random, URL-safe secret for edit links and sessions. Only its hash is stored. */
export function newToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * A 4-digit request code people can read out on the phone. It is not a secret on its own:
 * looking anything up needs the code AND the phone number, and lookups are rate-limited.
 */
export function newCode(): string {
  return String(randomInt(1000, 10000));
}
