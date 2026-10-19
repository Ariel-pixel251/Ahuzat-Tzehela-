import { expect, test, type Page } from "@playwright/test";

// Full resident flows at 360px: everything by big buttons, one question per screen.

const next = (page: Page) => page.getByRole("button", { name: "הבא", exact: true }).click();
const send = (page: Page) => page.getByRole("button", { name: "אני מאשר/ת ושולח/ת" }).click();

async function contact(page: Page, name: string, phone: string) {
  await page.getByLabel("שם", { exact: true }).fill(name);
  await page.getByLabel("טלפון", { exact: true }).fill(phone);
  await next(page);
}

test("register for an event (language night)", async ({ page }) => {
  await page.goto("/residents");
  await page.getByRole("link", { name: "אני רוצה להירשם לאירוע" }).click();
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

test("ask for help with the phone, then check the status by phone and code", async ({ page }) => {
  await page.goto("/residents");
  await page.getByRole("link", { name: "אני צריך/ה עזרה עם הטלפון או המחשב" }).click();
  await page.getByRole("button", { name: "וואטסאפ" }).click();
  await next(page);
  await page.getByRole("button", { name: "שני" }).click();
  await next(page);
  await expect(page.getByRole("heading", { name: "באילו שעות נוח לכם?" })).toBeVisible();
  // two scroll wheels, also usable with the "earlier/later" buttons and the keyboard
  const from = page.getByRole("spinbutton", { name: "משעה" });
  const until = page.getByRole("spinbutton", { name: "עד שעה" });
  await expect(from).toHaveAttribute("aria-valuetext", "10:00");
  await expect(until).toHaveAttribute("aria-valuetext", "12:00");
  await from.press("ArrowDown");
  await expect(from).toHaveAttribute("aria-valuetext", "10:30");
  await page.getByRole("button", { name: "מאוחר יותר" }).nth(1).click();
  await expect(until).toHaveAttribute("aria-valuetext", "12:30");
  // scrolling the wheel picks the time in the middle row
  // (until options start at 11:00, so 13:30 is the 6th row)
  await until.evaluate((el) => el.scrollTo({ top: 64 * 5, behavior: "instant" }));
  await expect(until).toHaveAttribute("aria-valuetext", "13:30");
  // "from" can't pass "until": at 13:30 the until wheel moves along to 14:30
  for (let i = 0; i < 7; i++) await from.press("ArrowDown");
  await expect(from).toHaveAttribute("aria-valuetext", "14:00");
  await expect(until).toHaveAttribute("aria-valuetext", "14:30");
  // the wheels fit the screen, also with bigger text
  for (const large of [false, true]) {
    if (large) await page.getByRole("button", { name: "הגדל טקסט" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  }
  await next(page);
  await next(page); // Hebrew is chosen already
  await contact(page, "שרה לוי", "052-765-4321");
  await expect(page.getByText("14:00–14:30")).toBeVisible();
  await send(page);
  await expect(page.getByRole("heading", { name: "תודה! קיבלנו." })).toBeVisible();
  const code = (await page.getByText(/^\d{4}$/).textContent())!.trim();

  await page.goto("/residents/status");
  await page.getByLabel("טלפון").fill("0527654321");
  await page.getByLabel("קוד הבקשה").fill(code);
  await page.getByRole("button", { name: "בדיקה" }).click();
  await expect(page.getByText("ממתין למתנדב")).toBeVisible();
});

test("no fixed time: 'send me a message and we'll arrange a time'", async ({ page }) => {
  await page.goto("/residents/help");
  await page.getByRole("button", { name: "מחשב", exact: true }).click();
  await next(page);
  await next(page); // any day
  const byMessage = page.getByRole("button", { name: "אין שעה קבועה? שלחו לי הודעה ונתאם" });
  await byMessage.click();
  await expect(byMessage).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  await next(page);
  await next(page);
  await contact(page, "דוד כהן", "054-222-3344");
  await expect(page.getByText("נתאם שעה בהודעה")).toBeVisible();
  await send(page);
  await expect(page.getByRole("heading", { name: "תודה! קיבלנו." })).toBeVisible();

  await page.goto("/students/digital");
  await expect(page.getByText("Arrange the time by message").first()).toBeVisible();
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
