# Design system

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

## Colour tokens (`app/globals.css`)

Measured from the logo files (most common non-white pixels):

| Logo | Measured | Token |
| --- | --- | --- |
| ביחד לדורות, arc | `#164884` | `brand` |
| ביחד לדורות, lettering | `#90CCCC` | `teal` (decoration only) |
| Ahuzat Tzahala | `#78182A` | `maroon` |
| EMIS | `#FC4A10` | `emis` (decoration only) |

| Token | Hex | Contrast | Use |
| --- | --- | --- | --- |
| `ink` | `#111111` | 18.9:1 on white | All body text |
| `muted` | `#333333` | 12.6:1 | Secondary text |
| `brand` | `#164884` | 9.2:1 (white on it) | Main buttons, links, selected choices, both portals |
| `brand-dark` | `#0F3566` | 12.2:1 | Hover on brand |
| `brand-soft` | `#E9F0F8` | ink 16.4:1 on it | Info notices, nav hover |
| `sand` (teal tint) | `#EEF6F6` | ink 16:1 on it | Control bars, hover backgrounds, full choices |
| `maroon` | `#78182A` | 10.7:1 | Residents' accent: heading side bar, the residents' door on the landing page |
| `maroon-soft` | `#F8ECEE` | — | Hover on the residents' door |
| `emis` | `#FC4A10` | 3.4:1, **never text** | Students' accent: stripes, card top borders |
| `emis-text` | `#B5300A` | 6.2:1 (AA) | Orange text, student portal only |
| `teal` | `#90CCCC` | 1.8:1, **never text** | Decorative stripe |
| `line` | `#595959` | 7:1 | Borders |
| `focus` | `#FFBF47` + ink halo | — | Focus ring |
| `ok` / `bad` / `warn` (+ `-soft`) | unchanged | ≥ 7:1 | Status messages |

Rules:

- **Resident portal: every text colour is AAA (≥ 7:1).** The raw logo orange and teal are never used for text or for anything a
  resident has to read.
- **Student portal: AA (≥ 4.5:1)** for text; UI borders ≥ 3:1.
- No gradients, no shadows on text, no text over logos or pictures.

## Typography

- Heebo (variable), self-hosted through `@fontsource-variable/heebo` (no external font requests, CSP stays strict).
- Residents: 22px base (27px with "הגדל טקסט"), line height 1.6, headings 32px+.
- Students and admin: 17px base, line height 1.55.

## Components

- **Logo header**: the three logos on white, then a flat 6px stripe in the four logo colours (decorative, hidden from screen
  readers, no motion), then the control bar on the teal tint.
- **Buttons**: `brand` fill with white text (9.2:1); secondary is white with an ink border; 56px+ tall (residents' big
  home buttons 88px+).
- **Choice buttons** (resident wizard): white with a 4px ink border; selected = `brand` fill + check mark; full = teal tint,
  "מלא" written out, not clickable.
- **Cards** (students): 2px grey border with an 8px EMIS-orange top edge; hover outlines in `brand`.
- **Headings**: the project name, with a thick side bar on the subtitle, maroon for residents and orange for students.

## Motion

- Resident portal: **none** (no transitions, no animations, also without `prefers-reduced-motion`).
- Student portal: colour changes only (150ms), switched off with `prefers-reduced-motion`.

## Direction (RTL)

- Only logical CSS (`ms-`/`me-`/`ps-`/`pe-`/`start`/`end`/`border-s`); no `left`/`right` classes anywhere (checked with a search).
- The logo row is always `dir="ltr"` so the logos keep a fixed order in both portals; phone numbers and emails are `dir="ltr"`.
