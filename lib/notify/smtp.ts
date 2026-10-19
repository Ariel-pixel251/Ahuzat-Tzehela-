import { readEnv } from "@/lib/env";

export type SmtpSettings = { host: string; port: number; secure: boolean; user: string; pass: string; from: string };

/**
 * Email through any normal mailbox (SMTP), e.g. a Gmail account with an app password: no domain
 * needed. For Gmail only SMTP_USER and SMTP_PASSWORD are needed; the server is filled in.
 */
export function smtpSettings(env: (name: string) => string | undefined = readEnv): SmtpSettings | null {
  const user = env("SMTP_USER");
  let pass = env("SMTP_PASSWORD");
  if (!user || !pass) return null;
  const gmail = /@(gmail|googlemail)\.com$/i.test(user);
  const host = env("SMTP_HOST") ?? (gmail ? "smtp.gmail.com" : undefined);
  if (!host) return null;
  const port = Number(env("SMTP_PORT") ?? 465) || 465;
  // Google shows app passwords in groups of four ("abcd efgh ijkl mnop")
  if (/(^|\.)gmail\.com$|googlemail/i.test(host)) pass = pass.replace(/\s+/g, "");
  return { host, port, secure: port === 465, user, pass, from: env("EMAIL_FROM") ?? `"אמיס - אחוזת צהלה - ביחד לדורות" <${user}>` };
}
