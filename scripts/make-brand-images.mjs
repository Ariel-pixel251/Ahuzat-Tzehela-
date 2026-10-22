// Builds the browser-tab icons and the social share image from the logos in public/logos/.
// Run after changing a logo: node scripts/make-brand-images.mjs
// Logos are only ever scaled down (never up), never cropped or recoloured; the rest is white space.
import sharp from "sharp";

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const logo = (file) => `public/logos/${file}`;

/** A logo fitted inside a box (aspect ratio kept, never enlarged). */
async function fit(file, width, height) {
  const buf = await sharp(logo(file)).resize({ width, height, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const meta = await sharp(buf).metadata();
  return { buf, width: meta.width, height: meta.height };
}

async function square(size, file, out) {
  const pad = Math.round(size * 0.06);
  const img = await fit(file, size - 2 * pad, size - 2 * pad);
  await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: img.buf, left: Math.round((size - img.width) / 2), top: Math.round((size - img.height) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(out);
}

// tab icons: the "ביחד לדורות" logo on white
await square(512, "beyachad-ledorot.png", "public/icons/icon-512.png");
await square(180, "beyachad-ledorot.png", "public/icons/apple-touch-icon.png");
await square(48, "beyachad-ledorot.png", "public/icons/favicon-48.png");

// share image (1200 × 630): EMIS × Ahuzat Tzahala on top, "ביחד לדורות" below, on white
const W = 1200;
const H = 630;
const emis = await fit("emis.png", 420, 160);
const ahuzat = await fit("ahuzat-tzahala.png", 200, 200);
const together = await fit("beyachad-ledorot.png", 453, 192);
const gap = 90;
const rowWidth = emis.width + gap + ahuzat.width;
const rowTop = 70;
const rowHeight = Math.max(emis.height, ahuzat.height);
const left = Math.round((W - rowWidth) / 2);
const times = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${gap}" height="${rowHeight}"><text x="50%" y="58%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#333">×</text></svg>`,
);
await sharp({ create: { width: W, height: H, channels: 4, background: WHITE } })
  .composite([
    { input: emis.buf, left, top: rowTop + Math.round((rowHeight - emis.height) / 2) },
    { input: times, left: left + emis.width, top: rowTop },
    { input: ahuzat.buf, left: left + emis.width + gap, top: rowTop + Math.round((rowHeight - ahuzat.height) / 2) },
    { input: together.buf, left: Math.round((W - together.width) / 2), top: rowTop + rowHeight + 70 },
  ])
  .png({ compressionLevel: 9 })
  .toFile("public/og.png");

// email logos: twice their display height in emails (LOGO_HEIGHTS.email in config/logos.ts), so
// they're sharp on retina screens without sending the large originals
const EMAIL_HEIGHTS = { "emis.png": 28, "ahuzat-tzahala.png": 48, "beyachad-ledorot.png": 52 };
for (const [file, height] of Object.entries(EMAIL_HEIGHTS)) {
  await sharp(logo(file)).resize({ height: height * 2, withoutEnlargement: true }).png({ compressionLevel: 9 }).toFile(`public/logos/email/${file}`);
}

console.log("Wrote public/icons/*.png, public/og.png and public/logos/email/*.png");
