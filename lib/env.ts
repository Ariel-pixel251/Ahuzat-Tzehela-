/**
 * Reads a setting from the environment, forgiving copy-paste mistakes: surrounding spaces, line breaks
 * and quotes are removed. Empty values count as missing.
 */
export function readEnv(name: string): string | undefined {
  return cleanEnvValue(process.env[name]);
}

export function cleanEnvValue(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  let value = raw.trim();
  // "value" or 'value' pasted with its quotes
  if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) value = value.slice(1, -1).trim();
  return value || undefined;
}

/** Email addresses in a list typed by hand: "a@x.com, b@y.com", one per line, or "Name <a@x.com>". */
export function parseEmailList(raw: string | undefined): string[] {
  return [...(raw ?? "").matchAll(/[^\s,;<>"']+@[^\s,;<>"']+/g)].map((m) => m[0].toLowerCase());
}

/** Allowed student email domains (STUDENT_EMAIL_DOMAINS, e.g. "emis.org.il"); empty means any. */
export function studentEmailDomains(): string[] {
  return (readEnv("STUDENT_EMAIL_DOMAINS") ?? "")
    .split(/[\s,;]+/)
    .map((d) => d.replace(/^@/, "").trim().toLowerCase())
    .filter(Boolean);
}

export function studentEmailAllowed(email: string, domains = studentEmailDomains()): boolean {
  if (!domains.length) return true;
  const domain = email.toLowerCase().split("@").at(-1) ?? "";
  return domains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/** "production", "preview" or "development" on Vercel; "local" elsewhere. */
export function deploymentEnv() {
  return process.env.VERCEL_ENV ?? "local";
}
