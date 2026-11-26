import { expect, type Locator, type Page } from "@playwright/test";

// Shared steps for the end-to-end tests (local database, no Supabase: "Dev sign-in" for admins).

// the report-a-problem wizard (one question per screen)
export const next = (page: Page) => page.getByRole("button", { name: "הבא", exact: true }).click();
export const send = (page: Page) => page.getByRole("button", { name: "אני מאשר/ת ושולח/ת" }).click();

/**
 * A resident's sign-up, the same two screens everywhere: tap the slot (skipped for events), then
 * name and phone and "להירשם". `extra` taps a button in the extra row first.
 */
export async function residentSignUp(page: Page, p: { slot?: RegExp; name: string; phone: string; extra?: string }) {
  if (p.slot) await page.getByRole("button", { name: p.slot }).first().click();
  await expect(page.getByRole("heading", { name: "איך קוראים לך ומה מספר הטלפון?" })).toBeVisible();
  await page.getByLabel("שם", { exact: true }).fill(p.name);
  await page.getByLabel("טלפון", { exact: true }).fill(p.phone);
  if (p.extra) await page.getByRole("radio", { name: p.extra, exact: true }).or(page.getByRole("button", { name: p.extra, exact: true })).click();
  await page.getByRole("button", { name: "להירשם" }).click();
}

/** A student's sign-up inside a slot or podcast-time card; `card` is the card's list item. */
export async function studentCardSignUp(card: Locator, p: { name: string; email: string; topic?: string; under18?: { guardian: string; phone: string } }) {
  await card.getByRole("button", { name: /^Sign up/ }).click();
  await card.getByLabel("Full name").fill(p.name);
  await card.getByLabel("School email").fill(p.email);
  if (p.topic) await card.getByLabel("Topic").selectOption({ label: p.topic });
  if (p.under18) {
    await card.getByLabel("I'm under 18").check();
    await card.getByLabel("Parent or guardian's name").fill(p.under18.guardian);
    await card.getByLabel("Parent or guardian's phone").fill(p.under18.phone);
  }
  await card.getByLabel(/I agree to the/).check();
  await card.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(card.getByText("You're in!")).toBeVisible();
}

/** "YYYY-MM-DD", n days from today. */
export const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export async function adminSignIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByRole("button", { name: "Dev sign-in" }).click();
  await page.waitForURL("**/admin");
}

/** Creates a slot (or a weekly series) on /admin/digital-support; the admin must be signed in. */
export async function createSlot(
  page: Page,
  s: { date: string; start?: string; end?: string; place: string; placeEn?: string; residents?: number; helpers?: number; until?: string },
) {
  await page.goto("/admin/digital-support");
  const form = page.locator("section", { has: page.getByRole("heading", { name: "Create slots" }) });
  await form.getByLabel("Date (first date)").fill(s.date);
  await form.getByLabel("Start").fill(s.start ?? "16:00");
  await form.getByLabel("End").fill(s.end ?? "17:30");
  await form.getByLabel("Place, as residents read it (Hebrew)").fill(s.place);
  if (s.placeEn) await form.getByLabel("Place (English, optional)").fill(s.placeEn);
  await form.getByLabel("Resident places").fill(String(s.residents ?? 4));
  await form.getByLabel("Student helpers needed").fill(String(s.helpers ?? 2));
  await form.getByLabel("Booking closes (hours before)").fill("");
  if (s.until) {
    await form.getByLabel("Repeat every week (same weekday and time)").check();
    await form.getByLabel("Until (last date)").fill(s.until);
  }
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expect(form.getByRole("status")).toContainText(s.until ? "weekly slots" : "Slot created");
}

/** Creates a podcast time on /admin/podcast; the admin must be signed in. */
export async function createPodcastTime(
  page: Page,
  t: { date: string; start?: string; end?: string; place: string; placeEn?: string; residents?: number; students?: number; until?: string },
) {
  await page.goto("/admin/podcast");
  const section = page.getByRole("region", { name: "Podcast times" });
  await section.getByText("Add a podcast time").click();
  await section.getByLabel("Date (first date)").fill(t.date);
  await section.getByLabel("From").fill(t.start ?? "16:00");
  await section.getByLabel("Until", { exact: true }).fill(t.end ?? "17:30");
  await section.getByLabel("Place, as residents read it (Hebrew)").fill(t.place);
  if (t.placeEn) await section.getByLabel("Place (English, optional)").fill(t.placeEn);
  await section.getByLabel("Places for residents").fill(String(t.residents ?? 1));
  await section.getByLabel("Places for students").fill(String(t.students ?? 1));
  if (t.until) {
    await section.getByLabel("Repeat every week (same weekday and time)").check();
    await section.getByLabel("Until (last date)").fill(t.until);
  }
  await section.getByRole("button", { name: "Create", exact: true }).click();
  await expect(section.getByRole("status")).toContainText(t.until ? "weekly podcast times" : "Podcast time created");
}
