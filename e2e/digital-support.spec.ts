import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { adminSignIn, contact, createSlot, inDays, next, send, studentSignIn } from "./helpers";

// Digital support end to end: the admin sets slots, a resident books one, a student volunteers.
test.describe.configure({ mode: "serial" });

const PLACE = "בחדר הקהילה";

test("admin creates a weekly slot series", async ({ page }) => {
  await adminSignIn(page);
  await createSlot(page, { date: inDays(3), until: inDays(3 + 21), place: PLACE, placeEn: "Community room", residents: 2, helpers: 1 });
  await expect(page.locator("main li").filter({ hasText: "Weekly" })).toHaveCount(4);
  // and one for tomorrow, for the 48-hour contact rule below
  await createSlot(page, { date: inDays(1), start: "18:00", end: "19:00", place: "בספרייה", placeEn: "Library", residents: 1, helpers: 1 });
});

test("a resident books a slot: time, need, name and phone, then a calm confirmation with a code", async ({ page }) => {
  await page.goto("/residents");
  await page.getByRole("link", { name: "עזרה עם הטלפון או המחשב" }).click();
  await expect(page.getByRole("heading", { name: "מתי נוח לכם לבוא?" })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag2aaa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  // plain Hebrew date, the place and the free places
  const first = page.getByRole("radio", { name: new RegExp(`${PLACE}`) }).first();
  await expect(first).toContainText(/יום (ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת), \d+ ב.+, 16:00 עד 17:30/);
  await expect(first).toContainText("נשארו 2 מקומות");
  await first.click();
  await next(page);
  await page.getByRole("button", { name: "וואטסאפ" }).click();
  await next(page);
  await contact(page, "רבקה כהן", "050-123-4567");
  await expect(page.getByRole("heading", { name: "זה מה שמילאתם:" })).toBeVisible();
  await send(page);
  await expect(page.getByRole("heading", { name: "תודה! קיבלנו." })).toBeVisible();
  await expect(page.getByText(PLACE).first()).toBeVisible();
  await expect(page.getByText(/^\d{4}$/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  // the same phone can't take a second place in the same slot
  await page.goto("/residents/help");
  await page.getByRole("radio", { name: new RegExp(PLACE) }).first().click();
  await next(page);
  await page.getByRole("button", { name: "טלפון" }).first().click();
  await next(page);
  await contact(page, "רבקה כהן", "0501234567");
  await send(page);
  await expect(page.getByText("כבר שמרנו לכם מקום במועד הזה.").first()).toBeVisible();
});

test("a full slot shows 'מלא' and can't be chosen", async ({ page }) => {
  // tomorrow's slot has 1 place: fill it
  await page.goto("/residents/help");
  await page.getByRole("radio", { name: /בספרייה/ }).click();
  await next(page);
  await page.getByRole("button", { name: "אימייל" }).click();
  await next(page);
  await contact(page, "יוסף לוי", "052-765-4321");
  await send(page);
  await expect(page.getByRole("heading", { name: "תודה! קיבלנו." })).toBeVisible();

  await page.goto("/residents/help");
  const full = page.getByRole("radio", { name: /בספרייה/ });
  await expect(full).toContainText("מלא");
  await expect(full).toHaveAttribute("aria-disabled", "true");
  await full.click({ force: true });
  await next(page);
  await expect(page.getByText("נא לבחור אחת מהאפשרויות")).toBeVisible();
});

test("a student volunteers; sees first names and needs, and the phone only within 48 hours after the code of conduct", async ({ page }) => {
  await studentSignIn(page, "Dana Student", "dana@emis.test");

  // volunteering needs the age group first
  await page.goto("/students/digital-support");
  await page.locator("li", { hasText: "Library" }).getByRole("button", { name: "Volunteer for this slot" }).click();
  await expect(page.getByText(/please fill in your age group/)).toBeVisible();

  await page.goto("/students/mine");
  await page.getByLabel("Age group").selectOption("under-18");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Under 18: please fill in your parent or guardian/)).toBeVisible();
  await page.getByLabel("Parent or guardian's name").fill("Ruth Student");
  await page.getByLabel("Parent or guardian's phone").fill("054-111-2222");
  await page.getByLabel(/My parent or guardian knows/).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved. Thank you!")).toBeVisible();

  await page.goto("/students/digital-support");
  const library = page.locator("li", { hasText: "Library" });
  await library.getByRole("button", { name: "Volunteer for this slot" }).click();
  await expect(library.getByText("You're signed up", { exact: true })).toBeVisible();
  const community = page.locator("li", { hasText: "Community room" }).first();
  await community.getByRole("button", { name: "Volunteer for this slot" }).click();
  await expect(community.getByText("You're signed up", { exact: true })).toBeVisible();

  await page.goto("/students/mine");
  // first names and needs only; no surnames, no phones yet (code of conduct not accepted)
  await expect(page.getByText("רבקה").first()).toBeVisible();
  await expect(page.getByText("כהן")).toHaveCount(0);
  await expect(page.getByText("052-765-4321")).toHaveCount(0);
  await expect(page.getByText("050-123-4567")).toHaveCount(0);

  await page.getByLabel("I have read and accept the code of conduct").check();
  await page.getByRole("button", { name: "Accept the code of conduct" }).click();
  await expect(page.getByText("You've accepted the code of conduct.")).toBeVisible();
  await page.reload();
  // tomorrow's slot (within 48 hours): the phone shows; the slot in 3 days: still hidden
  await expect(page.getByText("052-765-4321")).toBeVisible();
  await expect(page.getByText("050-123-4567")).toHaveCount(0);
});

test("the admin sees bookings and helpers, and can cancel a slot", async ({ page }) => {
  await adminSignIn(page);
  await page.goto("/admin/digital-support");
  const library = page.locator("main li").filter({ hasText: "בספרייה" }).first();
  await expect(library).toContainText("יוסף לוי");
  await expect(library).toContainText("Dana Student");
  await library.getByRole("button", { name: "Cancel this slot (notify everyone)" }).click();
  await expect(library.getByText("Cancelled", { exact: true })).toBeVisible();
  await page.goto("/admin/messages");
  await expect(page.getByText("המועד").first()).toBeVisible();
});
