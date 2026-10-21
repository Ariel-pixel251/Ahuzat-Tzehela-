import { expect, test } from "@playwright/test";

// Headers, admin access, and hostile values in URL parameters.

test("security headers: CSP with a nonce, no framing, HSTS, nosniff, no referrer", async ({ request }) => {
  for (const path of ["/", "/residents", "/students", "/admin/login"]) {
    const res = await request.get(path);
    const h = res.headers();
    expect(h["content-security-policy"], path).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["content-security-policy"]).toContain("form-action 'self'");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("no-referrer");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["x-powered-by"]).toBeUndefined();
  }
});

test("pages work under the CSP (scripts run: the wizard moves on)", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy/i.test(m.text())) violations.push(m.text());
  });
  await page.goto("/residents/callback");
  await page.getByLabel("שם", { exact: true }).fill("משה");
  await page.getByLabel("טלפון", { exact: true }).fill("0541234567");
  await page.getByRole("button", { name: "הבא", exact: true }).click();
  await expect(page.getByRole("heading", { name: "זה מה שמילאתם:" })).toBeVisible();
  expect(violations).toEqual([]);
});

test("admin pages, actions and exports need a signed-in admin", async ({ page, request }) => {
  for (const path of ["/admin", "/admin/digital-support", "/admin/events", "/admin/podcast", "/admin/safety", "/admin/audit", "/admin/register", "/admin/setup"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/admin\/login$/);
  }
  for (const dataset of ["digital", "registrations", "podcast", "reports", "nope"]) {
    const res = await request.get(`/admin/export/${dataset}`, { maxRedirects: 0 });
    expect(res.status(), dataset).toBe(401);
  }
  expect((await request.get("/api/cron/daily")).status()).toBe(401);
  expect((await request.get("/api/cron/daily", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
});

const PAYLOADS = ["<script>alert(1)</script>", "' OR '1'='1", "\"><img src=x onerror=alert(1)>", "../../../etc/passwd", "%00", "a".repeat(3000)];

test("hostile URL parameters: no errors, no reflected markup, no data", async ({ request }) => {
  for (const payload of PAYLOADS) {
    const q = encodeURIComponent(payload);
    for (const path of [
      `/residents/register?event=${q}`,
      `/students/register?event=${q}`,
      `/residents/manage/help?token=${q}`,
      `/residents/manage/event?token=${q}`,
      `/students/manage/event?token=${q}`,
      `/students/podcast/manage?token=${q}`,
      `/students/auth?token=${q}`,
      `/residents/events?more=${q}`,
      `/?code=${q}`,
      `/admin/auth/callback?code=${q}&next=https://evil.example`,
    ]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBeLessThan(500);
      const body = await res.text();
      expect(body, path).not.toContain("<script>alert(1)</script>");
      expect(body, path).not.toContain("onerror=alert(1)");
      // no database or validation errors and no stack traces in the page
      expect(body, path).not.toMatch(/syntax error at or near|SQLSTATE|PostgresError|ZodError|\n\s+at \S+ \(\//);
      // never an open redirect to another site
      expect(res.headers()["location"] ?? "", path).not.toContain("evil.example");
    }
  }
});
