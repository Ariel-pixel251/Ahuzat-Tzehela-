import { expect, test } from "@playwright/test";
import { adminSignIn, createPodcastTime, inDays, residentSignUp, studentCardSignUp } from "./helpers";

// Podcast times work like digital support slots: the admin creates them (once or weekly), residents
// and students pick one, and a time for one of each pairs them automatically.

test("an admin creates a weekly podcast time and it appears on both portals", async ({ page }) => {
  const first = inDays(15);
  const until = inDays(15 + 14);
  await adminSignIn(page);
  await createPodcastTime(page, { date: first, until, start: "13:00", end: "14:00", place: "בגינה", placeEn: "Garden", residents: 2, students: 2 });
  const section = page.getByRole("region", { name: "Podcast times" });
  await expect(section.locator("li").filter({ hasText: "Garden" })).toHaveCount(3);

  await page.goto("/students/podcast");
  await expect(page.locator("main li").filter({ hasText: "Garden" })).toHaveCount(3);
  await page.goto("/residents/podcast");
  await expect(page.getByRole("button", { name: /בשעה 13:00 · בגינה/ })).toHaveCount(3);
});

test("a student and a resident pick the same podcast time and show up as paired in admin", async ({ page }) => {
  await adminSignIn(page);
  await createPodcastTime(page, { date: inDays(12), start: "15:00", end: "16:00", place: "בחדר המוזיקה", placeEn: "Music room" });

  await page.goto("/residents/podcast");
  await residentSignUp(page, { slot: /בשעה 15:00 · בחדר המוזיקה/, name: "רחל גולן", phone: "053-777-1122" });
  await expect(page.getByRole("heading", { name: /נרשמת!/ })).toBeVisible();
  await expect(page.getByText(/נתראה ב.*בשעה 15:00, בחדר המוזיקה/)).toBeVisible();

  // full for residents now: not shown at all
  await page.goto("/residents/podcast");
  await expect(page.getByRole("button", { name: /בחדר המוזיקה/ })).toHaveCount(0);

  await page.goto("/students/podcast");
  await studentCardSignUp(page.locator("main li", { hasText: "Music room" }), { name: "Yael Student", email: "yael@emis.test", topic: "Music" });

  await page.goto("/admin/podcast");
  const card = page.getByRole("region", { name: "Podcast times" }).locator("li").filter({ hasText: "Music room" });
  await expect(card).toContainText("Residents 1/1");
  await expect(card).toContainText("Students 1/1");
  await expect(card.getByText("paired with Yael Student")).toBeVisible();
  await expect(card.getByText("paired with רחל גולן")).toBeVisible();
  await expect(page.getByText(/meets \d{4}-\d\d-\d\d 15:00, בחדר המוזיקה/)).toBeVisible();

  // cancelling the time tells both
  await card.getByRole("button", { name: /Cancel/ }).click();
  await expect(card.getByText("Cancelled", { exact: true })).toBeVisible();
  await page.goto("/admin/messages");
  await expect(page.getByText(/מועד הפודקאסט|בוטל/).first()).toBeVisible();
});
