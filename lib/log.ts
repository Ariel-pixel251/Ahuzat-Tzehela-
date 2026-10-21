// Server logs: details for the team, but never phone numbers or email addresses.

const EMAIL = /[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[a-z]{2,}/gi;
// 9+ digits, possibly with spaces, dashes, dots or a leading +: Israeli and international numbers
const PHONE = /\+?\d[\d\s.-]{7,}\d/g;

export function redact(text: string) {
  return text.replace(EMAIL, "[email]").replace(PHONE, "[phone]");
}

function describe(err: unknown) {
  if (err instanceof Error) {
    const code = (err as { code?: unknown }).code;
    return `${err.name}${code ? ` (${String(code)})` : ""}: ${err.message}${err.stack ? `\n${err.stack.split("\n").slice(1, 6).join("\n")}` : ""}`;
  }
  return String(err);
}

/** Logs an error with its context, with personal details removed. */
export function logError(context: string, err: unknown) {
  console.error(`[${context}] ${redact(describe(err))}`);
}
