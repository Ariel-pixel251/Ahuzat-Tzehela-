import { beforeEach, vi } from "vitest";

/**
 * Emails sent during a test. Without an email service, sendEmail logs each one with console.info
 * (local development and tests), so the log is what the person would have received.
 */
export function captureEmails() {
  const sent: string[] = [];
  const spy = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
    const text = args.map(String).join(" ");
    if (text.startsWith("[email]")) sent.push(text);
  });
  // each test starts with an empty inbox
  beforeEach(() => {
    sent.length = 0;
    spy.mockClear();
  });
  return sent;
}
