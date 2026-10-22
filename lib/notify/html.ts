import { BRAND } from "@/config/brand";
import { LOGOS, logoHeight, logoWidth, type LogoName } from "@/config/logos";
import { publicSiteUrl } from "@/lib/env";
import type { Locale } from "@/lib/i18n";

// The HTML version of an email: at the top "ביחד לדורות" with the branch label ("סניף EMIS", as
// real text, so it shows even when images are blocked), then the partners (EMIS, Ahuzat Tzahala)
// smaller, then the same text as the plain version. Images come from the site's own address and
// have alt text, so the email reads the same with images blocked.

const EMAIL_FILES: Record<LogoName, string> = {
  emis: "emis.png",
  ahuzat: "ahuzat-tzahala.png",
  beyachad: "beyachad-ledorot.png",
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function logoImg(name: LogoName, alt: string, base: string) {
  const height = logoHeight(name, "email");
  const width = logoWidth(name, height);
  const src = `${base}/logos/email/${EMAIL_FILES[name]}`;
  return (
    `<img src="${escapeHtml(src)}" width="${width}" height="${height}" alt="${escapeHtml(alt)}" ` +
    `style="display:block;border:0;width:${width}px;height:${height}px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#111111">`
  );
}

/** The organisation's logo and the branch label, side by side: never one without the other. */
function lockup(locale: Locale, base: string) {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" dir="${locale === "he" ? "rtl" : "ltr"}"><tr>` +
    `<td style="padding:0 8px;vertical-align:middle">${logoImg("beyachad", BRAND.organizationName[locale], base)}</td>` +
    `<td style="padding:0 8px;vertical-align:middle;font-family:Arial,sans-serif;font-size:22px;font-weight:bold;color:#111111;white-space:nowrap">` +
    `${escapeHtml(BRAND.branchLabel[locale])}</td>` +
    `</tr></table>`
  );
}

function partners(locale: Locale, base: string) {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" dir="${locale === "he" ? "rtl" : "ltr"}"><tr>` +
    `<td style="padding:0 8px;vertical-align:middle;font-family:Arial,sans-serif;font-size:14px;color:#333333">${escapeHtml(BRAND.partnersLabel[locale])}</td>` +
    `<td style="padding:0 8px;vertical-align:middle">${logoImg("emis", LOGOS.emis.alt[locale], base)}</td>` +
    `<td style="padding:0 8px;vertical-align:middle">${logoImg("ahuzat", LOGOS.ahuzat.alt[locale], base)}</td>` +
    `</tr></table>`
  );
}

/** The plain text as HTML: escaped, line breaks kept, web addresses as links. */
function textToHtml(text: string) {
  return escapeHtml(text)
    .replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#0b3d91">${url}</a>`)
    .replace(/\n/g, "<br>");
}

export function emailHtml(body: string, locale: Locale): string {
  const base = publicSiteUrl();
  const dir = locale === "he" ? "rtl" : "ltr";
  const align = locale === "he" ? "right" : "left";
  return (
    `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"></head>` +
    `<body style="margin:0;padding:0;background:#ffffff">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff">` +
    `<tr><td align="center" style="padding:20px 12px 8px">` +
    lockup(locale, base) +
    `</td></tr>` +
    `<tr><td align="center" style="padding:4px 12px 14px;border-bottom:2px solid #e5e5e5">` +
    partners(locale, base) +
    `</td></tr>` +
    `<tr><td dir="${dir}" style="padding:20px 24px 28px;font-family:Arial,sans-serif;font-size:17px;line-height:1.6;color:#111111;text-align:${align}">` +
    textToHtml(body) +
    `</td></tr></table></body></html>`
  );
}
