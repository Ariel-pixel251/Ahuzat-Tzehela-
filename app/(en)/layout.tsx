import "@fontsource-variable/heebo";
import "../globals.css";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { BRAND } from "@/config/brand";

export const metadata: Metadata = {
  title: { default: BRAND.en, template: `%s · ${BRAND.en}` },
  description: BRAND.description.en,
  openGraph: { title: BRAND.en, description: BRAND.description.en, siteName: BRAND.en, locale: "en_GB", type: "website" },
  robots: { index: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/**
 * Root layout for the landing page, the student portal and the admin area: English, left to right.
 * Reading the request headers renders every page per request, so Next.js can put the CSP nonce
 * (set in proxy.ts) on its scripts.
 */
export default async function EnglishLayout({ children }: { children: React.ReactNode }) {
  await headers();
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
