import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { publicSiteUrl } from "@/lib/env";

/**
 * Metadata shared by both root layouts: the tab icons and the share image (made from the logos by
 * scripts/make-brand-images.mjs), with absolute addresses on the production site.
 */
export function brandMetadata(locale: "en" | "he"): Metadata {
  return {
    metadataBase: new URL(publicSiteUrl()),
    title: { default: BRAND[locale], template: `%s · ${BRAND[locale]}` },
    description: BRAND.description[locale],
    icons: {
      icon: [
        { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
    },
    openGraph: {
      title: BRAND[locale],
      description: BRAND.description[locale],
      siteName: BRAND[locale],
      locale: locale === "he" ? "he_IL" : "en_GB",
      type: "website",
      images: [
        {
          url: "/og.png",
          width: 1200,
          height: 630,
          alt: locale === "he" ? "EMIS × אחוזת צהלה – ביחד לדורות" : "EMIS × Ahuzat Tzahala – Together for Generations",
        },
      ],
    },
    robots: { index: false },
  };
}
