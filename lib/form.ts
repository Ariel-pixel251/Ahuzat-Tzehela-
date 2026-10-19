// Tiny helpers safe to import in client components.

/** The invisible honeypot field. Real people never fill it in. */
export const HONEYPOT = "company_website";

/** Result of a server action, shown by the form that called it. */
export type ActionState = {
  ok: boolean;
  message?: string;
  /** field → message, already in the portal's language */
  errors?: Record<string, string>;
  code?: string;
  waitlist?: boolean;
  /** extra data for the page (e.g. a dev sign-in link, status results) */
  data?: unknown;
} | null;
