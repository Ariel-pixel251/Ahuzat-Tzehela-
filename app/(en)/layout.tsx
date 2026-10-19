import "@fontsource-variable/heebo";
import "../globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: { default: "Ahuzat Tzahala × EMIS", template: "%s · Ahuzat Tzahala" },
  description: "Activities, events and partnerships between EMIS students and the residents of Ahuzat Tzahala.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** Root layout for the landing page, the student portal and the admin area: English, left to right. */
export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
