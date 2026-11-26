import { expect, test } from "@playwright/test";
import { adminSignIn, createPodcastTime, createSlot, inDays, next, residentSignUp, send } from "./helpers";

// Full resident flows at 360px: every sign-up is the same two screens (when, then name and phone).

test("the home page: three big buttons only, no greeting, no description line and no 'contact us'", async ({ page }) => {
  await page.goto("/residents");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ביחד לדורות, סניף EMIS");
  await expect(page.getByText("סניף EMIS של ביחד לדורות, בשיתוף אחוזת צהלה")).toHaveCount(0);
  const buttons = page.locator("main ul a");
  await expect(buttons).toHaveText(["מה קורה השבוע?", "עזרה עם הטלפון או המחשב", "פודקאסט"]);
  await expect(page.getByText(/צרו איתי קשר|בקשו שאתקשר/)).toHaveCount(0);
  await expect(page.getByText(/שלום/)).toHaveCount(0);
  await expect(page).toHaveTitle("ביחד לדורות, סניף EMIS | אחוזת צהלה");
});

test("an event in two screens: the event is the time, so straight to name and phone", async ({ page }) => {
  await page.goto("/residents");
  await page.getByRole("link", { name: "מה קורה השבוע?" }).click();
  await page.getByRole("link", { name: /אני רוצה להגיע\s*: ערב שפות/ }).first().click();
  await expect(page.getByRole("heading", { name: "איך קוראים לך ומה מספר הטלפון?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "לשנות" })).toHaveCount(0);
  // 1 person is chosen already; languages are optional
  await expect(page.getByRole("radio", { name: "1", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "עברית" }).click();
  await page.getByRole("button", { name: "רוסית" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.getByLabel("שם", { exact: true }).fill("רבקה כהן");
  await page.getByLabel("טלפון", { exact: true }).fill("+972 50-123-4567");
  await page.getByRole("button", { name: "להירשם" }).click();
  await expect(page.getByRole("heading", { name: /נרשמת!/ })).toBeVisible();
  await expect(page.getByText(/^נתראה ב/)).toBeVisible();
  await expect(page.getByText(/^\d{4}$/)).toBeVisible();

  // the same phone again: the same calm success
  await page.reload();
  await page.getByLabel("שם", { exact: true }).fill("רבקה כהן");
  await page.getByLabel("טלפון", { exact: true }).fill("050-123-4567");
  await page.getByRole("button", { name: "להירשם" }).click();
  await expect(page.getByRole("heading", { name: /נרשמת!/ })).toBeVisible();
});

test("podcast, help and an event: each in 2 screens; full slots hidden; no 'arrange by message'; no dropdowns or email", async ({ page }) => {
  await adminSignIn(page);
  await createPodcastTime(page, { date: inDays(9), start: "10:00", end: "11:00", place: "בפינת הקפה", placeEn: "Cafe corner" });
  await createSlot(page, { date: inDays(9), start: "12:00", end: "13:00", place: "בפינת המחשב", placeEn: "Computer corner", residents: 1, helpers: 1 });

  // podcast: 1 tap (the time) + name + phone + 1 tap (להירשם); Hebrew is chosen already
  await page.goto("/residents/podcast");
  await expect(page.getByRole("radio", { name: "עברית" })).toHaveCount(0);
  await residentSignUp(page, { slot: /בפינת הקפה/, name: "אסתר", phone: "050-444-5555" });
  await expect(page.getByText(/נתראה ב.*בשעה 10:00, בפינת הקפה/)).toBeVisible();

  // help
  await page.goto("/residents/help");
  await residentSignUp(page, { slot: /בפינת המחשב/, name: "אסתר", phone: "050-444-5555" });
  await expect(page.getByText(/נתראה ב.*בשעה 12:00, בפינת המחשב/)).toBeVisible();

  // both now full for residents: not shown; the same phone again still shows success
  for (const [path, place] of [["/residents/podcast", /בפינת הקפה/], ["/residents/help", /בפינת המחשב/]] as const) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: place })).toHaveCount(0);
  }

  // event
  await page.goto("/residents/events");
  await page.getByRole("link", { name: /אני רוצה להגיע/ }).first().click();
  await residentSignUp(page, { name: "אסתר", phone: "050-444-5555" });
  await expect(page.getByRole("heading", { name: /נרשמת!/ })).toBeVisible();

  for (const path of ["/residents/podcast", "/residents/help", "/residents/events", "/residents/register?event=x"]) {
    await page.goto(path);
    await expect(page.getByText(/שלחו לי הודעה ונתאם|אף מועד לא מתאים/)).toHaveCount(0);
    await expect(page.locator("select")).toHaveCount(0);
    await expect(page.locator("input[type=email]")).toHaveCount(0);
  }
});

test("the code cancels from the status page", async ({ page }) => {
  await adminSignIn(page);
  await createSlot(page, { date: inDays(11), start: "09:00", end: "10:00", place: "בחדר הקריאה", placeEn: "Reading room", residents: 3, helpers: 1 });
  await page.goto("/residents/help");
  await residentSignUp(page, { slot: /בחדר הקריאה/, name: "שרה לוי", phone: "052-765-9999" });
  const code = (await page.getByText(/^\d{4}$/).textContent())!.trim();

  await page.goto("/residents/status");
  await page.getByLabel("טלפון").fill("0527659999");
  await page.getByLabel("קוד הבקשה").fill(code);
  await page.getByRole("button", { name: "בדיקה" }).click();
  await expect(page.getByText(/בחדר הקריאה/)).toBeVisible();
  await page.getByRole("button", { name: "ביטול ההרשמה" }).click();
  await expect(page.getByText("ההרשמה בוטלה.")).toBeVisible();
});

test("five wrong codes lock the status lookup for that phone number", async ({ page }) => {
  await page.goto("/residents/status");
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("טלפון").fill("0531112233");
    await page.getByLabel("קוד הבקשה").fill(String(1000 + i));
    await page.getByRole("button", { name: "בדיקה" }).click();
    await expect(page.getByText(/לא מצאנו בקשה/)).toBeVisible();
  }
  await page.getByLabel("קוד הבקשה").fill("1999");
  await page.getByRole("button", { name: "בדיקה" }).click();
  await expect(page.getByText(/נעשו יותר מדי ניסיונות/)).toBeVisible();
});

test("report a problem, from the link on every page", async ({ page }) => {
  await page.goto("/residents/events");
  await page.getByRole("link", { name: "דיווח על בעיה" }).click();
  await expect(page.getByRole("heading", { name: "דיווח על בעיה" })).toBeVisible();
  await page.getByLabel("מה קרה", { exact: true }).fill("מישהו ביקש ממני סיסמה");
  await next(page);
  await next(page); // name and phone are optional
  await send(page);
  await expect(page.getByText("תודה שסיפרתם לנו.")).toBeVisible();
  await expect(page.getByText(/^\d{4}$/)).toHaveCount(0);
});

test("'contact us' is gone: no call-back page or button anywhere", async ({ page }) => {
  for (const path of ["/residents", "/residents/events", "/residents/help", "/residents/podcast"]) {
    await page.goto(path);
    await expect(page.getByRole("link", { name: /שאתקשר|צרו איתי קשר/ })).toHaveCount(0);
  }
  const res = await page.goto("/residents/callback");
  expect(res?.status()).toBe(404);
});

test("a wizard (report a problem) can be completed with the keyboard only", async ({ page }) => {
  await page.goto("/residents/report");
  await page.getByLabel("מה קרה", { exact: true }).focus();
  await page.keyboard.type("משהו לא עובד");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter"); // "הבא"
  await expect(page.getByLabel("שם", { exact: true })).toBeVisible();
  await page.getByLabel("שם", { exact: true }).focus();
  await page.keyboard.type("דוד");
  await page.keyboard.press("Tab");
  await page.keyboard.type("0541234567");
  await page.keyboard.press("Enter"); // submits the step
  await expect(page.getByRole("heading", { name: "זה מה שמילאתם:" })).toBeFocused();
  const sendButton = page.getByRole("button", { name: "אני מאשר/ת ושולח/ת" });
  for (let i = 0; i < 20 && !(await sendButton.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "תודה! קיבלנו." })).toBeVisible();
});

test("bigger text is remembered after reload", async ({ page }) => {
  await page.goto("/residents");
  const toggle = page.getByRole("button", { name: "הגדל טקסט" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  const before = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  await toggle.click();
  await page.reload();
  await expect(page.getByRole("button", { name: "הגדל טקסט" })).toHaveAttribute("aria-pressed", "true");
  const after = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  expect(parseFloat(after)).toBeGreaterThan(parseFloat(before));
});

test("events show in plain Hebrew words, with one big button each", async ({ page }) => {
  await page.goto("/residents/events");
  const cards = page.locator("main li");
  await expect(cards).toHaveCount(5);
  await expect(cards.first()).toContainText(/יום (ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת), \d+ ב/);
  // the untagged staff meeting has no registration button
  const staff = cards.filter({ hasText: "Staff meeting" }).first();
  if (await staff.count()) await expect(staff.getByRole("link")).toHaveCount(0);
  await page.getByRole("link", { name: "לראות עוד" }).click();
  await expect(page.locator("main li")).not.toHaveCount(5);
});
