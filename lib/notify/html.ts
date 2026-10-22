import { LOGO_HEIGHTS, LOGOS, logoWidth, type LogoName } from "@/config/logos";
import { publicSiteUrl } from "@/lib/env";
import type { Locale } from "@/lib/i18n";

// The HTML version of an email: the three logos at the top (from the site's own address), then
// the same text as the plain version. Every image has alt text and the text stands on its own,
// so the email reads the same when images are blocked.

const EMAIL_FILES: Record<LogoName, string> = {
  emis: "emis.png",
  ahuzat: "ahuzat-tzahala.png",
  beyachad: "beyachad-ledorot.png",
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function logoCell(name: LogoName, locale: Locale, base: string) {
  const height = LOGO_HEIGHTS.email[name];
  const width = logoWidth(name, height);
  const src = `${base}/logos/email/${EMAIL_FILES[name]}`;
  return (
    `<td style="padding:0 10px;vertical-align:middle">` +
    `<img src="${escapeHtml(src)}" width="${width}" height="${height}" alt="${escapeHtml(LOGOS[name].alt[locale])}" ` +
    `style="display:block;border:0;width:${width}px;height:${height}px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#111111">` +
    `</td>`
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
    `<tr><td align="center" style="padding:20px 12px 12px;border-bottom:2px solid #e5e5e5">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" dir="ltr"><tr>` +
    logoCell("emis", locale, base) +
    logoCell("beyachad", locale, base) +
    logoCell("ahuzat", locale, base) +
    `</tr></table></td></tr>` +
    `<tr><td dir="${dir}" style="padding:20px 24px 28px;font-family:Arial,sans-serif;font-size:17px;line-height:1.6;color:#111111;text-align:${align}">` +
    textToHtml(body) +
    `</td></tr></table></body></html>`
  );
}
