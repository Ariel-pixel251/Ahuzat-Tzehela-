import { expect, test } from "@playwright/test";
import { contact, next, send } from "./helpers";

// Full resident flows at 360px: everything by big buttons, one question per screen.

test("the home page: the project's name and four big buttons, no greeting", async ({ page }) => {
  await page.goto("/residents");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("EMIS × אחוזת צהלה");
  await expect(page.getByText("פודקאסט, ליווי דיגיטלי ואירועים - ביחד")).toBeVisible();
  const buttons = page.locator("main ul a");
  await expect(buttons).toHaveText(["מה קורה השבוע?", "עזרה עם הטלפון או המחשב", "פודקאסט", "צרו איתי קשר"]);
  await expect(page.getByText(/שלום/)).toHaveCount(0);
  await expect(page).toHaveTitle("EMIS × אחוזת צהלה");
});

test("register for an event (language night)", async ({ page }) => {
  await page.goto("/residents");
  await page.getByRole("link", { name: "מה קורה השבוע?" }).click();
  await page.getByRole("link", { name: /אני רוצה להגיע\s*: ערב שפות/ }).first().click();
  await expect(page.getByText("שלב 1 מתוך 4")).toBeVisible();

  await next(page); // "אני לבד" is chosen already
  await next(page); // no language chosen yet
  await expect(page.getByText("נא לבחור אחת מהאפשרויות")).toBeVisible();
  await page.getByRole("button", { name: "עברית" }).click();
  await page.getByRole("button", { name: "רוסית" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await next(page);

  await page.getByLabel("שם", { exact: true }).fill("רבקה כהן");
  await page.getByLabel("טלפון", { exact: true }).fill("050 123 456");
  await next(page);
  await expect(page.getByText("נראה שחסרה ספרה, בדקו שוב")).toBeVisible();
  await page.getByLabel("טלפון", { exact: true }).fill("+972 50-123-4567");
  await next(page);

  await expect(page.getByRole("heading", { name: "זה מה שמילאתם:" })).toBeVisible();
  await expect(page.getByText("050-123-4567")).toBeVisible();
  await expect(page.getByText("עברית, רוסית")).toBeVisible();
  await send(page);

  await expect(page.getByRole("heading", { name: "תודה! קיבלנו." })).toBeVisible();
  await expect(page.getByText(/נרשמתם לערב שפות/)).toBeVisible();
  await expect(page.getByText(/^\d{4}$/)).toBeVisible();
});

test("podcast with no time that fits: 'send me a message and we'll arrange it', then check the status", async ({ page }) => {
  await page.goto("/residents");
  await page.getByRole("link", { name: "פודקאסט" }).click();
  await page.getByRole("button", { name: "סיפורי חיים" }).click();
  await next(page);
  await next(page); // Hebrew is chosen already
  await expect(page.getByRole("heading", { name: "מתי נוח לכם להיפגש?" })).toBeVisible();
  await next(page); // nothing chosen yet
  await expect(page.getByText("נא לבחור אחת מהאפשרויות")).toBeVisible();
  const byMessage = page.getByRole("radio", { name: "אף מועד לא מתאים? שלחו לי הודעה ונתאם" });
  await byMessage.click();
  await expect(byMessage).toHaveAttribute("aria-checked", "true");
  await next(page);
  await contact(page, "שרה לוי", "052-765-4321");
  await expect(page.getByText("אף מועד לא מתאים? שלחו לי הודעה ונתאם")).toBeVisible();
  await send(page);
  await expect(page.getByRole("heading", { name: "תודה! קיבלנו." })).toBeVisible();
  const code = (await page.getByText(/^\d{4}$/).textContent())!.trim();

  await page.goto("/residents/status");
  await page.getByLabel("טלפון").fill("0527654321");
  await page.getByLabel("קוד הבקשה").fill(code);
  await page.getByRole("button", { name: "בדיקה" }).click();
  await expect(page.getByText("מחפשים לכם שותף")).toBeVisible();
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

test("call me back, from the button on every page", async ({ page }) => {
  await page.goto("/residents/events");
  await page.getByRole("link", { name: "בקשו שאתקשר אליכם" }).click();
  await expect(page.getByRole("heading", { name: "נשמח להתקשר אליכם" })).toBeVisible();
  await contact(page, "משה", "03-1234567");
  await send(page);
  await expect(page.getByText("נתקשר אליכם בקרוב.")).toBeVisible();
});

test("the call-me-back wizard can be completed with the keyboard only", async ({ page }) => {
  await page.goto("/residents/callback");
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
