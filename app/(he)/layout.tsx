import "@fontsource-variable/heebo";
import "../globals.css";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { BRAND } from "@/config/brand";
import { textSizeScript } from "@/components/TextSizeToggle";

export const metadata: Metadata = {
  title: { default: BRAND.he, template: `%s · ${BRAND.he}` },
  description: BRAND.description.he,
  openGraph: { title: BRAND.he, description: BRAND.description.he, siteName: BRAND.he, locale: "he_IL", type: "website" },
  robots: { index: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/**
 * Root layout of the resident portal: Hebrew, right to left. Reading the request's CSP nonce
 * renders every page per request, so Next.js can put the nonce on its scripts.
 */
export default async function HebrewLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="he" dir="rtl" data-portal="residents" suppressHydrationWarning>
      <head>
        {/* a fixed script (no user data): applies the saved "bigger text" before the page paints */}
        {/* eslint-disable-next-line react/no-danger -- constant text from TextSizeToggle, never user input */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: textSizeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
