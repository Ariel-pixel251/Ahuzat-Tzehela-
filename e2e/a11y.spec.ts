import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { adminSignIn, createPodcastTime, inDays } from "./helpers";

const residentPages = [
  "/residents",
  "/residents/events",
  "/residents/help",
  "/residents/podcast",
  "/residents/status",
  "/residents/report",
  "/residents/privacy",
];

const studentPages = [
  "/",
  "/students",
  "/students/events",
  "/students/podcast",
  "/students/digital-support",
  "/students/code-of-conduct",
  "/students/report",
  "/students/privacy",
  "/admin/login",
];

// runs first (no digital support slots exist yet in the fresh test database)
test("no open slots: only one calm line, no greyed-out buttons", async ({ page }) => {
  await page.goto("/residents/help");
  await expect(page.getByText("אין כרגע מועדים פנויים. כדאי לבדוק שוב בקרוב.")).toBeVisible();
  await expect(page.locator("main button")).toHaveCount(0);
});

// Resident portal: WCAG 2.1 AA plus AAA contrast.
for (const path of residentPages) {
  test(`axe: ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag2aaa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}

for (const path of studentPages) {
  test(`axe: ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}

test("both sign-up screens and the success screen pass axe (AAA)", async ({ page }) => {
  const aaa = async () => {
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag2aaa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  };
  await adminSignIn(page);
  await createPodcastTime(page, { date: inDays(20), start: "11:00", end: "12:00", place: "בחדר הנגישות", placeEn: "Access room" });
  await page.goto("/residents/podcast");
  await expect(page.getByRole("heading", { name: "מתי נוח לך?" })).toBeVisible();
  await aaa();
  await page.getByRole("button", { name: /בחדר הנגישות/ }).click();
  await expect(page.getByRole("heading", { name: "איך קוראים לך ומה מספר הטלפון?" })).toBeVisible();
  await aaa();
  await page.getByLabel("שם", { exact: true }).fill("נגה");
  await page.getByLabel("טלפון", { exact: true }).fill("050-000-1111");
  await page.getByRole("button", { name: "להירשם" }).click();
  await expect(page.getByRole("heading", { name: /נרשמת!/ })).toBeVisible();
  await aaa();
});

// No horizontal scrolling at 360px, or at 200% zoom on a 1280px screen (= a 640px layout).
for (const [label, viewport] of [
  ["360px", { width: 360, height: 800 }],
  ["200% zoom", { width: 640, height: 400 }],
] as const) {
  test(`no horizontal scroll at ${label}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const path of residentPages) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
}
