// Finds the exact brand colours in the logo files and writes design/logo-colors.json.
// For each logo, the most common exact colour of each hue family (white, greys and the
// anti-aliased edge pixels are rare or skipped, so the solid fill wins).
// Run: node scripts/extract-logo-colors.mjs   (app/globals.css uses these values; a test checks it)
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const hex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

function hue(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** The most common exact colour among saturated pixels whose hue is within [from, to). */
async function solid(file, from, to) {
  const { data, info } = await sharp(`public/logos/${file}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const counts = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 250) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min < 40 || min > 235) continue; // white and greys
    const h = hue(r, g, b);
    if (from < to ? h < from || h >= to : h < from && h >= to) continue;
    const key = hex(r, g, b);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return best[0];
}

const colors = {
  // hue ranges: orange 0–40, maroon (red) 330–20 wrapping, blue 200–240, teal 160–200
  emisOrange: await solid("emis.png", 5, 40),
  ahuzatMaroon: await solid("ahuzat-tzahala.png", 330, 20),
  beyachadBlue: await solid("beyachad-ledorot.png", 200, 240),
  beyachadTeal: await solid("beyachad-ledorot.png", 160, 200),
};
await writeFile("design/logo-colors.json", JSON.stringify(colors, null, 2) + "\n");
console.log(colors);
