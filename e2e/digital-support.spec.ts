import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { adminSignIn, createSlot, inDays, residentSignUp, studentCardSignUp } from "./helpers";

// Digital support end to end: the admin sets slots, a resident books one, a student helps.
test.describe.configure({ mode: "serial" });

const PLACE = "בחדר הקהילה";

test("admin creates a weekly slot series", async ({ page }) => {
  await adminSignIn(page);
  await createSlot(page, { date: inDays(3), until: inDays(3 + 21), place: PLACE, placeEn: "Community room", residents: 2, helpers: 1 });
  await expect(page.locator("main li").filter({ hasText: "Weekly" })).toHaveCount(4);
  // and one for tomorrow with a single place
  await createSlot(page, { date: inDays(1), start: "18:00", end: "19:00", place: "בספרייה", placeEn: "Library", residents: 1, helpers: 1 });
});

test("a resident books a slot in two screens: a calm confirmation with when, where and the code", async ({ page }) => {
  await page.goto("/residents");
  await page.getByRole("link", { name: "עזרה עם הטלפון או המחשב" }).click();
  await expect(page.getByRole("heading", { name: "מתי נוח לך?" })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag2aaa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  // plain Hebrew date and time, and the place
  const first = page.getByRole("button", { name: new RegExp(PLACE) }).first();
  await expect(first).toHaveText(/^יום (ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת), \d+ ב.+, בשעה 16:00 · בחדר הקהילה$/);
  expect((await first.boundingBox())!.height).toBeGreaterThanOrEqual(72);
  await first.click();
  // screen 2 is the summary: the chosen slot with "לשנות", and no step counter
  await expect(page.getByText(/בשעה 16:00 · בחדר הקהילה/)).toBeVisible();
  await expect(page.getByText(/שלב \d מתוך/)).toHaveCount(0);
  await page.getByRole("button", { name: "לשנות" }).click();
  await expect(page.getByRole("heading", { name: "מתי נוח לך?" })).toBeVisible();
  await first.click();
  // nothing selected is fine; errors are next to the field, and what was typed stays
  await page.getByLabel("שם", { exact: true }).fill("רבקה כהן");
  await page.getByLabel("טלפון", { exact: true }).fill("050 123 456");
  await page.getByRole("button", { name: "להירשם" }).click();
  await expect(page.getByText("נראה שחסרה ספרה, בדקו שוב")).toBeVisible();
  await expect(page.getByLabel("שם", { exact: true })).toHaveValue("רבקה כהן");
  await page.getByRole("button", { name: "וואטסאפ" }).click();
  await page.getByLabel("טלפון", { exact: true }).fill("050-123-4567");
  await page.getByRole("button", { name: "להירשם" }).click();
  await expect(page.getByRole("heading", { name: /נרשמת!/ })).toBeVisible();
  await expect(page.getByText(/נתראה ב.*בשעה 16:00, בחדר הקהילה/)).toBeVisible();
  await expect(page.getByText(/^\d{4}$/)).toBeVisible();
  await expect(page.getByText("צריך אותו רק אם רוצים לבטל")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  // the same phone again for the same slot: the same success, no error
  await page.goto("/residents/help");
  await residentSignUp(page, { slot: new RegExp(PLACE), name: "רבקה כהן", phone: "0501234567" });
  await expect(page.getByRole("heading", { name: /נרשמת!/ })).toBeVisible();
});

test("a full slot isn't shown at all; 'ביטול ההרשמה' frees it again", async ({ page }) => {
  // tomorrow's slot has 1 place: fill it
  await page.goto("/residents/help");
  await residentSignUp(page, { slot: /בספרייה/, name: "יוסף לוי", phone: "052-765-4321" });
  await expect(page.getByRole("heading", { name: /נרשמת!/ })).toBeVisible();
  await page.goto("/residents/help");
  await expect(page.getByRole("button", { name: /בספרייה/ })).toHaveCount(0);

  // a wrong tap: cancel right on the success screen
  await page.goto("/residents/help");
  await residentSignUp(page, { slot: new RegExp(PLACE), name: "משה כץ", phone: "054-222-3333" });
  await page.getByRole("button", { name: "ביטול ההרשמה" }).click();
  await expect(page.getByRole("heading", { name: "ההרשמה בוטלה." })).toBeVisible();
});

test("a student signs up on the card; never sees residents' phone numbers or surnames", async ({ page }) => {
  await page.goto("/students/digital-support");
  const library = page.locator("main li", { hasText: "Library" });
  await expect(library).toContainText("1 resident booked");
  await studentCardSignUp(library, { name: "Dana Student", email: "dana@emis.test" });
  await page.reload();
  await expect(page.locator("main li", { hasText: "Library" })).toContainText("Enough helpers");
  for (const text of ["052-765-4321", "0527654321", "050-123-4567", "כהן", "לוי"]) await expect(page.getByText(text)).toHaveCount(0);
  // the cancel link from the email: opening it changes nothing; the button cancels
  const res = await page.goto("/students/digital-support/cancel?token=not-a-real-token-at-all-000000");
  expect(res?.status()).toBe(200);
  await expect(page.getByText("This link is not valid any more.")).toBeVisible();
});

test("the admin sees bookings and helpers, and can cancel a slot", async ({ page }) => {
  await adminSignIn(page);
  await page.goto("/admin/digital-support");
  const library = page.locator("main li").filter({ hasText: "בספרייה" }).first();
  await expect(library).toContainText("יוסף לוי");
  await expect(library).toContainText("Dana Student");
  await expect(library).toContainText("18 or older");
  await library.getByRole("button", { name: "Cancel this slot (notify everyone)" }).click();
  await expect(library.getByText("Cancelled", { exact: true })).toBeVisible();
  await page.goto("/admin/messages");
  await expect(page.getByText("המועד").first()).toBeVisible();
});
