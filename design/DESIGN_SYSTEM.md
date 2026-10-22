# Design system

> **v2 (branding):** the site is the **EMIS branch** of the organisation "ביחד לדורות" (Together for Generations), in
> partnership with Ahuzat Tzahala. See "Brand structure" below; it overrides the earlier "EMIS × אחוזת צהלה" heading
> and logo row.

Made with the **UI UX Pro Max** skill (`.claude/skills/ui-ux-pro-max`), then adapted to this project's rules.
The resident portal's simplicity rules (CLAUDE.md) always win over anything here.

```
python3 .claude/skills/ui-ux-pro-max/scripts/search.py \
  "intergenerational community nonprofit seniors elderly accessibility school volunteering" \
  --design-system -p "Beyachad Ledorot"
```

## What the skill recommended, and what we took

| Skill recommendation | Decision |
| --- | --- |
| Style **Accessible & Ethical**: high contrast, large text, keyboard navigation, screen-reader friendly, visible focus, semantic HTML, WCAG AAA | **Taken.** It matches the resident portal's rules exactly. |
| Pattern "Community landing" (member counts, showcases, join CTA) | **Not taken.** The landing page is two doors; no marketing sections. |
| Palette: purple `#7C3AED` + green CTA | **Replaced** by a palette from the project's logos (below). The skill itself lists "AI purple/pink gradients" as an anti-pattern. |
| Font: Atkinson Hyperlegible | **Not taken:** it has no Hebrew letters. **Heebo** (already self-hosted, Hebrew + Latin) stays for both portals, so the two portals look like one project. |
| Effects: 3–4px focus rings, skip links, reduced motion, 44×44px targets | **Taken and exceeded:** 4px amber ring + 7px dark halo; skip link (students); no motion on the resident portal at all; 56px+ targets for residents, 44px+ for students. |
| Anti-patterns: small text, complex navigation | **Taken.** |
| Checklist: SVG icons not emoji, pointer cursor on clickables, 4.5:1 text contrast, visible focus, reduced motion, responsive 375–1440px | **Taken.** Pointer cursor added for buttons (Tailwind's reset removes it). |

## Brand structure (v2)

1. **Parent brand:** the "ביחד לדורות" logo, only through `components/BrandLockup.tsx`, always with
2. **the branch label** "סניף EMIS" / "EMIS Branch" right beside it (headers) or under it (landing), in the same
   size class as the tagline (`e2e/branding.spec.ts` fails on any page that shows the logo without it; a unit test
   checks no other component uses the logo file). Also on the tab icon, the share image and emails.
3. **Partners:** EMIS and Ahuzat Tzahala, smaller, in a partners strip ("בשיתוף" / "In partnership with").
4. **Footer disclaimer** on every page: not the whole organisation's official website (wording to be confirmed).

Names, tagline, tab titles and disclaimer: `config/brand.ts`. Logo sizes and clear space: `config/logos.ts`.

| Place | Layout |
| --- | --- |
| Landing `/` | Logo (260px wide on phones, up to 320px) → "סניף EMIS" / "EMIS Branch" (30–34px, bold) → tagline in both languages (22px) → two equal doors, 96px+ tall (stacked on phones, side by side from 640px): residents with the Ahuzat Tzahala emblem and a maroon border, students with the EMIS logo and an orange border → footer: partners strip, disclaimer, privacy links |
| Resident header | Not sticky. Lockup (logo + "סניף EMIS", links home) at the start, Ahuzat Tzahala emblem at the end; then "חזרה לדף הראשי" and "הגדל טקסט" |
| Resident home | Hidden heading for screen readers, the tagline once (small), the three big buttons (96px+), nothing else |
| Student header | Lockup (logo + "EMIS Branch", links home) at the start, EMIS logo at the end; then the menu (with "Home") |
| Footers | Light teal tint; links; partners strip on a white panel (the logos have white backgrounds); disclaimer |

## Colour tokens (`app/globals.css`)

Measured exactly from the logo files with `node scripts/extract-logo-colors.mjs` (most common exact colour of each
hue in each logo; written to `design/logo-colors.json`; `tests/brand.test.ts` checks the tokens match):

| Logo | Measured | Token |
| --- | --- | --- |
| ביחד לדורות, arc | `#124789` | `brand` |
| ביחד לדורות, lettering | `#8ACCCA` | `teal` (decoration only) |
| Ahuzat Tzahala | `#741529` | `maroon` |
| EMIS | `#FE480F` | `emis` (decoration only) |

| Token | Hex | Contrast | Use |
| --- | --- | --- | --- |
| `ink` | `#111111` | 18.9:1 on white | All body text |
| `muted` | `#333333` | 12.6:1 | Secondary text |
| `brand` | `#124789` | 9.2:1 (white on it) | **Main UI colour, both portals:** buttons, links, selected choices |
| `brand-dark` | `#0F3566` | 12.2:1 | Hover on brand |
| `brand-soft` | `#E9F0F8` | ink 16.4:1 on it | Info notices, nav hover |
| `sand` (teal tint) | `#EEF6F6` | ink 16:1 on it | Control bars, footers, hover backgrounds, full choices |
| `teal` | `#8ACCCA` | 1.8:1, **never text** | Card top edges (students) |
| `maroon` | `#741529` | 11.2:1 | **Only** resident-side partner elements (the residents' door on the landing page) |
| `maroon-soft` | `#F8ECEE` | — | Hover on the residents' door |
| `emis` | `#FE480F` | 3.4:1, **never text** | **Only** student-side partner elements (the students' door border) |
| `emis-text` | `#B5300A` | 6.2:1 (AA) | Orange text, if ever needed, student portal only |
| `line` | `#595959` | 7:1 | Borders |
| `focus` | `#FFBF47` + ink halo | — | Focus ring |
| `ok` / `bad` / `warn` (+ `-soft`) | unchanged | ≥ 7:1 | Status messages |

Rules:

- **Resident portal: every text colour is AAA (≥ 7:1).** **Student portal: AA (≥ 4.5:1)**; UI borders ≥ 3:1.
- No gradients, no text over logos or pictures, no animation, carousels or parallax, no decorative clutter.
- Logos: never recoloured, cropped, stretched, rotated or shadowed, never on a dark background; clear space from
  `LOGO_SPACING`; never shown wider than twice the file's width.

## Typography

- Heebo (variable), self-hosted through `@fontsource-variable/heebo` (no external font requests, CSP stays strict).
- Residents: 22px base (27px with "הגדל טקסט"), line height 1.6, headings 32px+.
- Students and admin: 17px base, line height 1.55.

## Components

- **BrandLockup** (`components/BrandLockup.tsx`): the organisation's logo + branch label as one unit. The image's alt
  text is the full name ("ביחד לדורות, סניף EMIS"); the visible label is hidden from screen readers so the name isn't
  read twice. `priority` in headers.
- **PartnerLogo / PartnersStrip** (`components/Logos.tsx`): EMIS and Ahuzat Tzahala at the sizes in `config/logos.ts`;
  inside the landing doors the logo is decorative (`alt=""`) because the button's words already name it.
- **Buttons**: `brand` fill with white text (9.2:1); secondary is white with an ink border; 56px+ tall (residents'
  big home buttons 96px+).
- **Choice buttons** (resident wizard): white with a 4px ink border; selected = `brand` fill + check mark; full = teal
  tint, "מלא" written out, not clickable.
- **Cards** (students): 2px grey border with an 8px teal top edge; hover outlines in `brand`.

## Motion

- Resident portal: **none** (no transitions, no animations, also without `prefers-reduced-motion`).
- Student portal: colour changes only (150ms), switched off with `prefers-reduced-motion`.

## Direction (RTL)

- Only logical CSS (`ms-`/`me-`/`ps-`/`pe-`/`start`/`end`/`border-s`); no `left`/`right` classes anywhere (checked with a search).
- Headers follow the portal's direction: in Hebrew the lockup is on the right and the partner emblem on the left; in
  English the other way round. Inside the lockup the logo comes first in reading order, then the label.
- The partners strip keeps a fixed order (EMIS, then Ahuzat Tzahala); phone numbers and emails are `dir="ltr"`.
- Checked at 360, 768 and 1280px and at 200% zoom (`e2e/branding.spec.ts`: no sideways scrolling, the header
  lockup stays on one line).
