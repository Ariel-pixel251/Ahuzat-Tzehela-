import Image from "next/image";
import Link from "next/link";
import { LOGO_HEIGHTS, LOGOS, logoWidth, type LogoName, type LogoPlace } from "@/config/logos";

type Locale = "en" | "he";

/** One logo at its configured size for a place: aspect ratio kept, never stretched or recoloured. */
export function Logo({ name, place, locale, priority = false }: { name: LogoName; place: LogoPlace; locale: Locale; priority?: boolean }) {
  const height = LOGO_HEIGHTS[place][name];
  const width = logoWidth(name, height);
  return (
    <Image
      src={LOGOS[name].src}
      alt={LOGOS[name].alt[locale]}
      width={width}
      height={height}
      sizes={`${width}px`}
      priority={priority}
      // shrinks with the screen if it must (keeping the ratio), never grows past its size
      className="h-auto max-w-full shrink object-contain"
      style={{ width, maxHeight: height }}
    />
  );
}

/**
 * The three logos in a row: EMIS and Ahuzat Tzahala on the sides, "ביחד לדורות" in the middle.
 * With `href`, the row links to that page (the page also keeps a text link home).
 */
export function LogoBar({
  place,
  locale,
  href,
  label,
  priority = false,
  className = "",
}: {
  place: "header" | "footer";
  locale: Locale;
  /** link target (the portal's home); `label` is the link's name, e.g. "EMIS, ביחד לדורות, אחוזת צהלה: לדף הראשי" */
  href?: string;
  label?: string;
  priority?: boolean;
  className?: string;
}) {
  const row = (
    <span className="flex items-center justify-center gap-3 sm:gap-6" dir="ltr">
      <Logo name="emis" place={place} locale={locale} priority={priority} />
      <Logo name="beyachad" place={place} locale={locale} priority={priority} />
      <Logo name="ahuzat" place={place} locale={locale} priority={priority} />
    </span>
  );
  return (
    <div className={`bg-white ${className}`}>
      {href ? (
        <Link href={href} aria-label={label} className="inline-flex rounded-lg p-1 no-underline">
          {row}
        </Link>
      ) : (
        row
      )}
    </div>
  );
}
