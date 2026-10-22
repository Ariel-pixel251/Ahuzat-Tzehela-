// The logos, in one place: files, native sizes, alt text, display sizes and clear space.
// The originals are in assets/logos/ (see the README there); the site serves the copies in public/logos/.
// These logos belong to their organisations and are used with their permission (see README.md).
// Never recolour, crop, stretch, rotate or shadow a logo, or put one on a dark background.

export type LogoName = "emis" | "ahuzat" | "beyachad";

export const LOGOS: Record<LogoName, { src: string; width: number; height: number; alt: { en: string; he: string } }> = {
  // EMIS (Eastern Mediterranean International School). The original is WebP data in a .png file;
  // public/logos/emis.png is the same image saved as a real PNG (email clients need that).
  emis: { src: "/logos/emis.png", width: 1213, height: 469, alt: { en: "EMIS", he: "EMIS" } },
  ahuzat: { src: "/logos/ahuzat-tzahala.png", width: 224, height: 224, alt: { en: "Ahuzat Tzahala", he: "אחוזת צהלה" } },
  // the parent organisation, "ביחד לדורות": only ever shown inside BrandLockup, with the branch label
  beyachad: {
    src: "/logos/beyachad-ledorot.png",
    width: 453,
    height: 192,
    alt: { en: "Together for Generations, EMIS Branch", he: "ביחד לדורות, סניף EMIS" },
  },
};

/**
 * Display heights in CSS pixels for each place a logo appears. Raster logos are never shown wider
 * than twice their file's width (the "ביחד לדורות" file is 453px wide, so at most ~320px here).
 */
export const LOGO_HEIGHTS = {
  /** landing page: the organisation's logo, large (width 260px on phones, up to 320px) */
  landing: { beyachad: 136 },
  /** portal headers: the lockup at the start, one partner emblem at the end */
  header: { beyachad: 48, ahuzat: 48, emis: 28 },
  /** inside the two portal buttons on the landing page */
  door: { ahuzat: 56, emis: 40 },
  /** the partners strip at the bottom of the landing page */
  partners: { ahuzat: 64, emis: 56 },
  /** the partners strip in the portals' footers */
  footer: { ahuzat: 48, emis: 40 },
  /** email header (twice these sizes are in public/logos/email/, see scripts/make-brand-images.mjs) */
  email: { beyachad: 52, ahuzat: 40, emis: 24 },
} as const satisfies Record<string, Partial<Record<LogoName, number>>>;

export type LogoPlace = keyof typeof LOGO_HEIGHTS;

/** The landing logo's width: 260px on phones, growing with the screen to 320px. */
export const LANDING_LOGO_WIDTH = "clamp(260px, 60vw, 320px)";

/** Clear space around logos and between logo and label, in CSS pixels. */
export const LOGO_SPACING = {
  /** between the organisation's logo and the branch label */
  lockupGap: 8,
  /** between partner logos in a strip */
  partnersGap: 32,
  /** padding around the header row */
  headerPadding: 12,
};

/** Width that keeps the logo's aspect ratio at a given height. */
export const logoWidth = (name: LogoName, height: number) => Math.round((LOGOS[name].width / LOGOS[name].height) * height);

export function logoHeight(name: LogoName, place: LogoPlace): number {
  const h = (LOGO_HEIGHTS[place] as Partial<Record<LogoName, number>>)[name];
  if (!h) throw new Error(`No size for the ${name} logo in "${place}" (config/logos.ts)`);
  return h;
}
