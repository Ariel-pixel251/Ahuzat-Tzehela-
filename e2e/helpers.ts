import { expect, type Page } from "@playwright/test";

// Shared steps for the end-to-end tests (local database, no Supabase: "Dev sign-in" for admins).

export const next = (page: Page) => page.getByRole("button", { name: "הבא", exact: true }).click();
export const send = (page: Page) => page.getByRole("button", { name: "אני מאשר/ת ושולח/ת" }).click();

export async function contact(page: Page, name: string, phone: string) {
  await page.getByLabel("שם", { exact: true }).fill(name);
  await page.getByLabel("טלפון", { exact: true }).fill(phone);
  await next(page);
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
export async function createPodcastTime(page: Page, t: { date: string; start?: string; end?: string; place: string; placeEn?: string; pairs?: number }) {
  await page.goto("/admin/podcast");
  const section = page.getByRole("region", { name: "Podcast times" });
  await section.getByText("Add a podcast time").click();
  await section.getByLabel("Date (first date)").fill(t.date);
  await section.getByLabel("From").fill(t.start ?? "16:00");
  await section.getByLabel("Until", { exact: true }).fill(t.end ?? "17:30");
  await section.getByLabel("Place, as residents read it (Hebrew)").fill(t.place);
  if (t.placeEn) await section.getByLabel("Place (English, optional)").fill(t.placeEn);
  await section.getByLabel("Pairs").fill(String(t.pairs ?? 1));
  await section.getByRole("button", { name: "Create", exact: true }).click();
  await expect(section.getByRole("status")).toContainText("Podcast time created");
}

/** Signs a student in with the on-screen link (email isn't set up locally). */
export async function studentSignIn(page: Page, name: string, email: string) {
  await page.goto("/students/sign-in");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/I agree to the privacy notice/).check();
  await page.getByRole("button", { name: "Email me a link" }).click();
  await page.goto((await page.locator("a.break-all").getAttribute("href"))!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/students/mine");
}
