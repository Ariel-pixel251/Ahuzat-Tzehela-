import "@fontsource-variable/heebo";
import "../globals.css";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { brandMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = brandMetadata("en");

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
