import { expect, test, type Locator, type Page } from "@playwright/test";

// The logos: where they are, their alt text, their shape (never stretched), the links home, and the
// tab icon and share image. The layout must not scroll sideways at 360px or at 200% zoom.

const NATIVE = { emis: 1213 / 469, ahuzat: 1, beyachad: 453 / 192 };

/** The image has loaded and keeps the logo's own aspect ratio. */
async function expectLogo(img: Locator, ratio: number) {
  await expect(img).toBeVisible();
  const box = await img.evaluate((el: HTMLImageElement) => ({ w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height, loaded: el.complete && el.naturalWidth > 0 }));
  expect(box.loaded).toBe(true);
  expect(Math.abs(box.w / box.h - ratio)).toBeLessThan(0.05);
}

const noSideScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

test("landing: EMIS × Ahuzat Tzahala above the name, 'ביחד לדורות' below", async ({ page }) => {
  await page.goto("/");
  const header = page.locator("header");
  await expectLogo(header.getByRole("img", { name: "EMIS" }), NATIVE.emis);
  await expectLogo(header.getByRole("img", { name: "אחוזת צהלה" }), NATIVE.ahuzat);
  await expectLogo(header.getByRole("img", { name: "ביחד לדורות" }), NATIVE.beyachad);
  const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
  const partners = await header.getByRole("img", { name: "EMIS" }).boundingBox();
  const program = await header.getByRole("img", { name: "ביחד לדורות" }).boundingBox();
  expect(partners!.y).toBeLessThan(heading!.y);
  expect(program!.y).toBeGreaterThan(heading!.y);
});

test("residents: logos linking home in the header, the text link home too, logos in the footer", async ({ page }) => {
  await page.goto("/residents/events");
  const home = page.getByRole("link", { name: "EMIS, ביחד לדורות, אחוזת צהלה: לדף הראשי" });
  await expectLogo(home.getByRole("img", { name: "ביחד לדורות" }), NATIVE.beyachad);
  await expectLogo(home.getByRole("img", { name: "אחוזת צהלה" }), NATIVE.ahuzat);
  await expectLogo(home.getByRole("img", { name: "EMIS" }), NATIVE.emis);
  await expect(page.getByRole("link", { name: "חזרה לדף הראשי" })).toBeVisible();
  await expect(page.locator("footer").getByRole("img")).toHaveCount(3);
  await home.click();
  await expect(page).toHaveURL(/\/residents$/);
});

test("students: logos linking home (English alt text), the name as a text link, logos in the footer", async ({ page }) => {
  await page.goto("/students/events");
  const home = page.getByRole("link", { name: "EMIS, Together for Generations, Ahuzat Tzahala: home" });
  await expectLogo(home.getByRole("img", { name: "Together for Generations" }), NATIVE.beyachad);
  await expectLogo(home.getByRole("img", { name: "Ahuzat Tzahala" }), NATIVE.ahuzat);
  await expect(page.getByRole("link", { name: "EMIS × Ahuzat Tzahala" })).toBeVisible();
  await expect(page.locator("footer").getByRole("img")).toHaveCount(3);
  await home.click();
  await expect(page).toHaveURL(/\/students$/);
});

for (const [label, viewport] of [
  ["360px", { width: 360, height: 800 }],
  ["200% zoom", { width: 640, height: 400 }],
  ["desktop", { width: 1280, height: 800 }],
] as const) {
  test(`logos fit without sideways scrolling at ${label}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const path of ["/", "/residents", "/students"]) {
      await page.goto(path);
      await noSideScroll(page);
    }
  });
}

test("tab icon and share image come from the logos", async ({ page, request }) => {
  await page.goto("/residents");
  await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute("href", /\/icons\/(favicon-48|icon-512)\.png/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /\/icons\/apple-touch-icon\.png/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https?:\/\/.+\/og\.png/);
  for (const path of ["/og.png", "/icons/icon-512.png", "/logos/emis.png", "/logos/email/beyachad-ledorot.png"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()["content-type"], path).toBe("image/png");
  }
});
