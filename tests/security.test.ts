import { RuleTester } from "eslint";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
// @ts-expect-error -- the ESLint config is plain JavaScript (no type declarations)
import eslintConfig from "../eslint.config.mjs";
import { Markdown } from "@/components/Markdown";
import { adminSessionFresh } from "@/lib/auth/admin-rules";
import { cronAuthorized } from "@/lib/cron";
import { redact } from "@/lib/log";
import { clean, templates } from "@/lib/notify/templates";
import { cleanText, v } from "@/lib/validation";

describe("SQL must be constant text (lint rule)", () => {
  const plugin = (eslintConfig as { plugins?: { local?: { rules: Record<string, unknown> } } }[]).find((c) => c.plugins?.local)!.plugins!.local!;
  const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } });
  test("interpolation and concatenation in query text fail; parameters pass", () => {
    tester.run("no-sql-interpolation", plugin.rules["no-sql-interpolation"] as never, {
      valid: [
        { code: "db.query(`select * from t where id = $1`, [id])" },
        { code: "db.query('select 1')" },
        { code: "db.query(SQL, [x])" },
      ],
      invalid: [
        { code: "db.query(`select * from t where id = '${id}'`)", errors: 1 },
        { code: "db.query('select * from t where id = ' + id)", errors: 1 },
        { code: "pg.exec(`drop table ${name}`)", errors: 1 },
        { code: "sql.unsafe('select ' + col)", errors: 1 },
      ],
    });
  });
});

describe("legal texts (Markdown)", () => {
  const html = (md: string) => renderToStaticMarkup(createElement(Markdown, { source: md }));
  test("only safe links; raw HTML is shown as text, never run", () => {
    expect(html("[ok](https://example.com) [mail](mailto:a@b.c)")).toContain('href="https://example.com"');
    expect(html("[bad](javascript:alert(1))")).not.toContain("href");
    expect(html("[bad](//evil.com)")).not.toContain("href");
    expect(html("<script>alert(1)</script>")).not.toContain("<script>");
    expect(html("<img src=x onerror=alert(1)>")).toContain("&lt;img");
  });
});

describe("emails can't be used for header injection", () => {
  test("values lose line breaks and control characters", () => {
    expect(clean("Party\r\nBcc: evil@example.com")).toBe("Party Bcc: evil@example.com");
    expect(clean("a\u0000b c")).toBe("a b c");
    const msg = templates.eventConfirmation("en", { name: "X\r\nBcc: a@b.c", title: "T\nTo: x@y.z", when: "now", waitlist: false, code: "1234" });
    expect(msg.subject).not.toMatch(/[\r\n]/);
    expect(msg.body.split("\n")[0]).toBe("Hi X Bcc: a@b.c,");
  });
});

describe("logs never hold phone numbers or emails", () => {
  test("redact", () => {
    expect(redact('duplicate key (phone)=(0501234567) for dana@emis.test and +44 20 7946 0958')).toBe(
      "duplicate key (phone)=([phone]) for [email] and [phone]",
    );
  });
});

describe("cron secret and admin sessions", () => {
  test("the cron secret is compared exactly (also in constant time)", () => {
    expect(cronAuthorized("Bearer s3cret", ["s3cret"])).toBe(true);
    expect(cronAuthorized("Bearer s3cre", ["s3cret"])).toBe(false);
    expect(cronAuthorized(null, ["s3cret"])).toBe(false);
    expect(cronAuthorized("Bearer ", [undefined, ""])).toBe(false);
  });

  test("an admin sign-in lasts 12 hours", () => {
    const now = Date.parse("2030-01-01T12:00:00Z");
    expect(adminSessionFresh("2030-01-01T01:00:00Z", now)).toBe(true);
    expect(adminSessionFresh("2029-12-31T23:59:00Z", now)).toBe(false);
    expect(adminSessionFresh(null, now)).toBe(false);
    expect(adminSessionFresh("not a date", now)).toBe(false);
  });
});

describe("input cleaning", () => {
  test("control characters and direction overrides are removed from text", () => {
    expect(cleanText("he\u0007llo‮ world")).toBe("hello world");
    expect(cleanText("line 1\r\n\r\n\r\nline 2", { multiline: true })).toBe("line 1\n\nline 2");
    expect(cleanText("line 1\nline 2")).toBe("line 1 line 2");
  });

  test("ids, tokens, dates and times are checked strictly", () => {
    expect(v.uuid.safeParse("' OR 1=1").success).toBe(false);
    expect(v.uuid.safeParse("123e4567-e89b-12d3-a456-426614174000").success).toBe(true);
    expect(v.token.safeParse("short").success).toBe(false);
    expect(v.date.safeParse("2030-02-30").success).toBe(false);
    expect(v.date.safeParse("2030-02-28").success).toBe(true);
    expect(v.time.safeParse("24:00").success).toBe(false);
    expect(v.eventKey.safeParse("uid with space").success).toBe(false);
    expect(v.name.safeParse("שרה לוי").success).toBe(true);
    expect(v.name.safeParse("O'Brien-Smith").success).toBe(true);
    expect(v.name.safeParse("Robert'); DROP TABLE students;--").success).toBe(false);
  });
});
