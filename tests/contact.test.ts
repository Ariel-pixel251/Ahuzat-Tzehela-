import { readFile } from "node:fs/promises";
import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

// The "contact us" feature is gone; the organisation's email is shown only in the privacy notices.

describe("the contact email (privacy notices only)", () => {
  test("filled in from config/brand.ts as a mailto link, or a visible placeholder until then", async () => {
    const { BRAND } = await import("@/config/brand");
    const { contactEmailMarkdown, legalText } = await import("@/lib/legal");
    const original = BRAND.contactEmail;
    try {
      (BRAND as { contactEmail: string }).contactEmail = "";
      expect(contactEmailMarkdown("he")).toBe("**[כתובת מייל]**");
      expect(await legalText("privacy-students")).toContain("**[contact email]**");
      (BRAND as { contactEmail: string }).contactEmail = "privacy@example.org";
      expect(contactEmailMarkdown("en")).toBe("[privacy@example.org](mailto:privacy@example.org)");
      const he = await legalText("privacy-residents");
      expect(he).toContain("(mailto:privacy@example.org)");
      expect(he).not.toContain("{{contact_email}}");
      // anything that isn't a plain email address is never turned into a link
      (BRAND as { contactEmail: string }).contactEmail = "x](javascript:alert(1))";
      expect(contactEmailMarkdown("en")).toBe("**[contact email]**");
    } finally {
      (BRAND as { contactEmail: string }).contactEmail = original;
    }
  });

  test("no call-back or contact-us texts are left in the portals' wording or the privacy notices", async () => {
    for (const file of ["lib/i18n/he.ts", "lib/i18n/en.ts", "lib/notify/templates.ts", "legal/privacy-residents.he.md", "legal/privacy-students.en.md"]) {
      const text = await readFile(file, "utf8");
      expect(text, file).not.toMatch(/צרו איתי קשר|בקשו שאתקשר|שנתקשר אליכם|callback|contact us/i);
    }
  });
});
