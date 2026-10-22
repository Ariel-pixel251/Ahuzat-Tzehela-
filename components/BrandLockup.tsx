import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { LANDING_LOGO_WIDTH, LOGO_SPACING, LOGOS, logoHeight, logoWidth } from "@/config/logos";

type Locale = "en" | "he";

/**
 * The "ביחד לדורות" logo with the branch label ("סניף EMIS" / "EMIS Branch") as ONE unit: the only
 * way the organisation's logo appears on the site, so the label can never be left out (an e2e test
 * checks every page). The image's alt text is the full name ("ביחד לדורות, סניף EMIS"); the visible
 * label repeats it, so screen readers skip the label instead of reading the name twice.
 *
 * - `landing`: large, label underneath (bilingual: "סניף EMIS", then "EMIS Branch")
 * - `header`: compact, label beside the logo; with `href` the whole lockup links home
 */
export function BrandLockup({
  locale,
  variant,
  href,
  priority = false,
}: {
  locale: Locale;
  variant: "landing" | "header";
  href?: string;
  priority?: boolean;
}) {
  const logo = LOGOS.beyachad;
  const height = logoHeight("beyachad", variant);
  const width = logoWidth("beyachad", height);
  const image = (
    <Image
      src={logo.src}
      alt={logo.alt[locale]}
      width={width}
      height={height}
      priority={priority}
      sizes={variant === "landing" ? "(min-width: 534px) 320px, 260px" : `${width}px`}
      className="h-auto max-w-full shrink-0 object-contain"
      style={variant === "landing" ? { width: LANDING_LOGO_WIDTH } : { width, maxHeight: height }}
    />
  );
  const label =
    variant === "landing" ? (
      // both languages on the bilingual landing page, one per line (the Hebrew one is already in
      // the alt text, so screen readers skip it)
      <span data-branch-label className="flex flex-col items-center text-[30px] font-black leading-tight text-ink sm:text-[34px]">
        <span lang="he" dir="rtl" aria-hidden="true">
          {BRAND.branchLabel.he}
        </span>
        <span lang="en" dir="ltr">
          {BRAND.branchLabel.en}
        </span>
      </span>
    ) : (
      // residents: 22px base, so this is 27px; students: 17px base, so 19px
      <span data-branch-label aria-hidden="true" className={`${locale === "he" ? "text-xl" : "text-lg"} font-black leading-tight whitespace-nowrap text-ink`}>
        {BRAND.branchLabel[locale]}
      </span>
    );
  const body = (
    <span
      data-brand-lockup
      className={variant === "landing" ? "flex flex-col items-center text-center" : "inline-flex items-center"}
      style={{ gap: LOGO_SPACING.lockupGap }}
    >
      {image}
      {label}
    </span>
  );
  if (!href) return body;
  return (
    <Link href={href} className="inline-flex rounded-lg p-1 no-underline">
      {body}
    </Link>
  );
}
