import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "אחוזת צהלה – פעילויות",
  description: "לוח הפעילויות של פרויקט אחוזת צהלה והרשמה לקבוצות, לאירועים ולשיעורים פרטיים.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            אחוזת צהלה
          </Link>
          <nav>
            <Link href="/schedule">לוח פעילויות</Link>
            <Link href="/signup">הרשמה</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
