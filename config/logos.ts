// The project's logos, in one place: files, native sizes, alt text and display sizes.
// The originals are in assets/logos/ (see the README there); the site serves the copies in public/logos/.
// These logos belong to their organisations and are used with their permission (see README.md).

export type LogoName = "emis" | "ahuzat" | "beyachad";

export const LOGOS: Record<LogoName, { src: string; width: number; height: number; alt: { en: string; he: string } }> = {
  // EMIS (Eastern Mediterranean International School). The original is WebP data in a .png file;
  // public/logos/emis.png is the same image saved as a real PNG (email clients need that).
  emis: { src: "/logos/emis.png", width: 1213, height: 469, alt: { en: "EMIS", he: "EMIS" } },
  ahuzat: { src: "/logos/ahuzat-tzahala.png", width: 224, height: 224, alt: { en: "Ahuzat Tzahala", he: "אחוזת צהלה" } },
  // "ביחד לדורות", the program's logo
  beyachad: { src: "/logos/beyachad-ledorot.png", width: 453, height: 192, alt: { en: "Together for Generations", he: "ביחד לדורות" } },
};

export type LogoPlace = "landing" | "header" | "footer" | "email";

/**
 * Display heights in CSS pixels. Never more than half a file's native height, so a retina (2x)
 * screen is served at most the file's own resolution and nothing is scaled up.
 */
export const LOGO_HEIGHTS: Record<LogoPlace, Record<LogoName, number>> = {
  landing: { emis: 56, ahuzat: 88, beyachad: 96 },
  header: { emis: 34, ahuzat: 48, beyachad: 52 },
  footer: { emis: 20, ahuzat: 32, beyachad: 36 },
  email: { emis: 28, ahuzat: 48, beyachad: 52 },
};

/** Width that keeps the logo's aspect ratio at a given height. */
export const logoWidth = (name: LogoName, height: number) => Math.round((LOGOS[name].width / LOGOS[name].height) * height);
