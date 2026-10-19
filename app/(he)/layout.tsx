import "@fontsource-variable/heebo";
import "../globals.css";
import type { Metadata, Viewport } from "next";
import { textSizeScript } from "@/components/TextSizeToggle";

export const metadata: Metadata = {
  title: { default: "אחוזת צהלה", template: "%s · אחוזת צהלה" },
  description: "פעילויות, אירועים ועזרה לדיירי אחוזת צהלה.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** Root layout of the resident portal: Hebrew, right to left. */
export default function HebrewLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" data-portal="residents" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: textSizeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
