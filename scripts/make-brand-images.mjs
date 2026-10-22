// Builds the browser-tab icons, the social share image and the small email logos from the logos in
// public/logos/. Run after changing a logo or the branding: node scripts/make-brand-images.mjs
//
// The "ביחד לדורות" logo always appears WITH the branch label ("סניף EMIS" / "EMIS Branch"), and the
// partners (EMIS, Ahuzat Tzahala) smaller underneath. Images with text are drawn by a headless browser
// with the site's own font (Heebo) so the Hebrew is shaped correctly. Logos are never recoloured,
// cropped, stretched or put on a dark background.
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const dataUri = async (path, type) => `data:${type};base64,${(await readFile(path)).toString("base64")}`;
const logo = (file) => dataUri(`public/logos/${file}`, "image/png");
const font = (subset) => dataUri(`node_modules/@fontsource-variable/heebo/files/heebo-${subset}-wght-normal.woff2`, "font/woff2");

const [together, emis, ahuzat, hebrew, latin] = await Promise.all([
  logo("beyachad-ledorot.png"),
  logo("emis.png"),
  logo("ahuzat-tzahala.png"),
  font("hebrew"),
  font("latin"),
]);

const page = (body, width, height) => `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Heebo; src: url(${hebrew}) format("woff2"); unicode-range: U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F; font-weight: 100 900; }
  @font-face { font-family: Heebo; src: url(${latin}) format("woff2"); font-weight: 100 900; }
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${width}px; height: ${height}px; background: #ffffff; color: #111111; font-family: Heebo, sans-serif; }
  body { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  img { display: block; }
</style></head><body>${body}</body></html>`;

const browser = await chromium.launch();
async function render(html, width, height, out) {
  const tab = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await tab.setContent(html, { waitUntil: "load" });
  await tab.evaluate(() => document.fonts.ready);
  const png = await tab.screenshot({ type: "png" });
  await tab.close();
  await sharp(png).png({ compressionLevel: 9 }).toFile(out);
  return png;
}

// tab icon: the organisation's logo with the branch label under it (the label is part of the icon)
const icon = await render(
  page(
    `<img src="${together}" style="width:440px;height:auto" alt="">
     <div dir="rtl" lang="he" style="margin-top:8px;font-size:92px;font-weight:900;line-height:1">סניף EMIS</div>`,
    512,
    512,
  ),
  512,
  512,
  "public/icons/icon-512.png",
);
await sharp(icon).resize(180, 180).png({ compressionLevel: 9 }).toFile("public/icons/apple-touch-icon.png");
await sharp(icon).resize(48, 48).png({ compressionLevel: 9 }).toFile("public/icons/favicon-48.png");

// share image (1200 × 630): the lockup, then the partners strip
await render(
  page(
    `<img src="${together}" style="width:340px;height:auto" alt="">
     <div dir="rtl" lang="he" style="margin-top:6px;font-size:58px;font-weight:900;line-height:1.1">סניף EMIS</div>
     <div lang="en" style="font-size:40px;font-weight:800;line-height:1.2">EMIS Branch</div>
     <div style="margin-top:34px;padding-top:22px;border-top:3px solid #e5e5e5;width:760px;display:flex;flex-direction:column;align-items:center;gap:12px">
       <div style="font-size:28px;font-weight:700"><span dir="rtl" lang="he">בשיתוף</span> · In partnership with</div>
       <div style="display:flex;align-items:center;gap:56px">
         <img src="${emis}" style="height:72px;width:auto" alt="">
         <img src="${ahuzat}" style="height:96px;width:auto" alt="">
       </div>
     </div>`,
    1200,
    630,
  ),
  1200,
  630,
  "public/og.png",
);
await browser.close();

// email logos: twice their display height in emails (LOGO_HEIGHTS.email in config/logos.ts), so
// they're sharp on retina screens without sending the large originals
const EMAIL_HEIGHTS = { "beyachad-ledorot.png": 52, "emis.png": 24, "ahuzat-tzahala.png": 40 };
for (const [file, height] of Object.entries(EMAIL_HEIGHTS)) {
  await sharp(`public/logos/${file}`).resize({ height: height * 2, withoutEnlargement: true }).png({ compressionLevel: 9 }).toFile(`public/logos/email/${file}`);
}

console.log("Wrote public/icons/*.png, public/og.png and public/logos/email/*.png");
