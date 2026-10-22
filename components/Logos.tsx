import Image from "next/image";
import { BRAND } from "@/config/brand";
import { LOGO_SPACING, LOGOS, logoHeight, logoWidth, type LogoPlace } from "@/config/logos";

type Locale = "en" | "he";

/**
 * A partner logo (EMIS or Ahuzat Tzahala) at its configured size: aspect ratio kept, never stretched
 * or recoloured. The organisation's logo ("ביחד לדורות") is never shown by itself: use BrandLockup.
 * `decorative`: the logo sits next to text that already says the same (e.g. inside a labelled button).
 */
export function PartnerLogo({
  name,
  place,
  locale,
  priority = false,
  decorative = false,
}: {
  name: "emis" | "ahuzat";
  place: LogoPlace;
  locale: Locale;
  priority?: boolean;
  decorative?: boolean;
}) {
  const height = logoHeight(name, place);
  const width = logoWidth(name, height);
  return (
    <Image
      src={LOGOS[name].src}
      alt={decorative ? "" : LOGOS[name].alt[locale]}
      width={width}
      height={height}
      sizes={`${width}px`}
      priority={priority}
      // shrinks with the screen if it must (keeping the ratio), never grows past its size
      className="h-auto max-w-full shrink-0 object-contain"
      style={{ width, maxHeight: height }}
    />
  );
}

/**
 * The partners strip: "בשיתוף" / "In partnership with", then EMIS and Ahuzat Tzahala side by side,
 * on the page's own light background.
 */
export function PartnersStrip({
  locale,
  place,
  bilingual = false,
  className = "",
}: {
  locale: Locale;
  place: "partners" | "footer";
  /** the landing page: "בשיתוף · In partnership with" */
  bilingual?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <p className="font-bold text-ink">
        {bilingual ? (
          <>
            <span lang="he">{BRAND.partnersLabel.he}</span> · <span lang="en">{BRAND.partnersLabel.en}</span>
          </>
        ) : (
          BRAND.partnersLabel[locale]
        )}
      </p>
      <div className="flex flex-wrap items-center justify-center" style={{ gap: LOGO_SPACING.partnersGap }} dir="ltr">
        <PartnerLogo name="emis" place={place} locale={locale} />
        <PartnerLogo name="ahuzat" place={place} locale={locale} />
      </div>
    </div>
  );
}
