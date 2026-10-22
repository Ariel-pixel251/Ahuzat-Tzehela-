// The site's names and wording about who runs it, in one place. Change it here and every page
// title, header, footer, email and message follows.
//
// Brand structure: "ביחד לדורות" (Together for Generations) is a larger organisation. This site is
// only its EMIS BRANCH, run together with the residence Ahuzat Tzahala. The organisation's logo is
// never shown without the branch label (components/BrandLockup.tsx), and the site must never look
// like the whole organisation's official website.

export const BRAND = {
  /** the parent organisation (its logo is shown only through components/BrandLockup.tsx) */
  organizationName: { he: "ביחד לדורות", en: "Together for Generations" },
  /** always shown with the organisation's logo, in the same size class as the tagline */
  branchLabel: { he: "סניף EMIS", en: "EMIS Branch" },
  /** the organisation and the branch together, as one name (alt text, email signatures) */
  branchName: { he: "ביחד לדורות, סניף EMIS", en: "Together for Generations, EMIS Branch" },
  tagline: {
    he: "סניף EMIS של ביחד לדורות, בשיתוף אחוזת צהלה",
    en: "The EMIS branch of Together for Generations, in partnership with Ahuzat Tzahala",
  },
  partnersLabel: { he: "בשיתוף", en: "In partnership with" },
  /** browser tab title (and the start of every page's title) */
  title: {
    he: "ביחד לדורות, סניף EMIS | אחוזת צהלה",
    en: "Together for Generations, EMIS Branch | Ahuzat Tzahala",
  },
  /**
   * Footer note. PLACEHOLDER: the wording is to be confirmed by the project owner with the
   * organisation.
   */
  disclaimer: {
    he: "אתר זה מנוהל על ידי סניף EMIS של ביחד לדורות ואינו האתר הרשמי של הארגון כולו.",
    en: "This site is run by the EMIS branch of Together for Generations and is not the official website of the whole organization.",
  },
  /**
   * The organisation's contact email, shown ONLY in the privacy notices (so people can ask to see or
   * delete their data). TO FILL IN, e.g. "privacy@em-is.org"; until then the notices show a placeholder.
   */
  contactEmail: "",
  description: {
    he: "סניף EMIS של ביחד לדורות, בשיתוף אחוזת צהלה: פודקאסט, ליווי דיגיטלי ואירועים לתלמידי EMIS ולדיירי אחוזת צהלה.",
    en: "The EMIS branch of Together for Generations, in partnership with Ahuzat Tzahala: podcast, digital support and events for EMIS students and the residents of Ahuzat Tzahala.",
  },
} as const;
