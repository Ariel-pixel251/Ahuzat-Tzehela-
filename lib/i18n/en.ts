// English text for the student portal, and the shape of the text both portals share.
import { BRAND } from "@/config/brand";

export type Shared = {
  tbc: string;
  allDay: string;
  noPreference: string;
  other: string;
  otherLanguageLabel: string;
  errors: {
    name: string;
    phoneEmpty: string;
    phoneShort: string;
    phoneLong: string;
    phoneInvalid: string;
    emailRequired: string;
    emailInvalid: string;
    choose: string;
    text: string;
    consent: string;
    generic: string;
    unavailable: string;
    rateLimited: string;
    duplicate: string;
    closed: string;
    notFound: string;
    alreadyJoined: string;
    emailNotSetUp: string;
    slotFull: string;
    slotClosed: string;
    slotDuplicate: string;
    locked: string;
  };
};

export const shared: Shared = {
  tbc: "Details coming soon",
  allDay: "All day",
  noPreference: "No preference",
  other: "Other",
  otherLanguageLabel: "Which other language?",
  errors: {
    name: "Please enter your name.",
    phoneEmpty: "Please enter a phone number.",
    phoneShort: "That phone number looks too short.",
    phoneLong: "That phone number looks too long.",
    phoneInvalid: "That doesn't look like a phone number. Use digits, e.g. 050-123-4567 or +44 20 7946 0958.",
    emailRequired: "Please enter your email.",
    emailInvalid: "Please enter a valid email address.",
    choose: "Please choose an option.",
    text: "Please fill this in.",
    consent: "Please confirm you agree to the privacy notice.",
    generic: "Something went wrong. Please try again.",
    unavailable: "Sign-ups are not available right now. Please try again later or ask a project leader.",
    rateLimited: "Too many attempts. Please wait a few minutes and try again.",
    duplicate: "You're already registered for this event.",
    closed: "Registration for this event is closed.",
    notFound: "We couldn't find that event.",
    alreadyJoined: "This email is already signed up for the podcast. Check your inbox for your link.",
    emailNotSetUp: "We can't send emails yet, so sign-in links aren't available. Please try again later or ask a project leader.",
    slotFull: "This slot is full. Please choose another one.",
    slotClosed: "Sign-up for this slot has closed. Please choose another one.",
    slotDuplicate: "You're already signed up for this slot.",
    locked: "Too many wrong codes for this phone number. Please try again tomorrow.",
  },
};

export const students = {
  branchName: BRAND.branchName.en,
  backToMain: "Back to main page",
  nav: {
    label: "Main",
    home: "Home",
    events: "Events",
    digital: "Digital support",
    podcast: "Podcast",
  },
  skip: "Skip to content",
  footer: { privacy: "Privacy notice", report: "Report a problem", residents: "פורטל הדיירים" },
  home: {
    keyEvents: "Coming up",
    allEvents: "All events",
    cards: {
      events: { title: "Events", text: "Game nights, language nights, parties and lectures. Register here." },
      digital: { title: "Digital support", text: "Choose a time slot to help residents with their phones and computers." },
      podcast: { title: "Podcast", text: "Pick a time, meet a resident and record a conversation together." },
    },
  },
  events: {
    title: "Events",
    lead: "Upcoming events. Times are Israel time.",
    none: "No upcoming events yet.",
    offline: "The live calendar couldn't be loaded, so these are the planned events.",
    register: "Register",
    joinPodcast: "Join the podcast",
    placesLeft: (n: number) => `${n} places left`,
    full: "Full: join the waiting list",
    closed: "Registration closed",
    closes: (d: string) => `Registration closes ${d}`,
  },
  form: {
    name: "Full name",
    email: "Email",
    phone: "Phone",
    phoneOptional: "Phone (optional)",
    phoneHint: "Israeli or international format.",
    attendees: "Number of people",
    notes: "Notes (optional)",
    languages: "Languages I can speak",
    languagesHint: "Choose all that apply.",
    otherLanguage: "Other language (optional)",
    playLanguage: "Play with someone who speaks my preferred language",
    preferredLanguage: "Preferred language",
    consent: "I agree to the privacy notice: my details are seen only by the project team (and, for matches, by my partner).",
    privacyLink: "Read the privacy notice",
    submit: "Submit",
    sending: "Sending…",
    selected: (n: number) => (n === 0 ? "Choose…" : `${n} selected`),
  },
  register: {
    title: "Register",
    registered: (title: string) => `You're registered for ${title}. A confirmation is on its way to your email.`,
    waitlist: "The event is full, so you're on the waiting list. We'll email you if a place opens up.",
    manageHint: "Use the link in the email to cancel if your plans change.",
  },
  /** The sign-up form inside a slot or podcast-time card. */
  card: {
    signUp: "Sign up",
    close: "Close",
    schoolEmail: "School email",
    schoolEmailOnly: (domains: string) => `Please use your school email (${domains}).`,
    under18: "I'm under 18",
    guardianName: "Parent or guardian's name",
    guardianPhone: "Parent or guardian's phone",
    guardianRequired: "Please fill in your parent or guardian's name and phone.",
    agree: "I agree to the",
    and: "and the",
    privacy: "privacy notice",
    conduct: "code of conduct",
    youreIn: "You're in!",
    emailSent: "We've emailed you the details and a link to cancel if your plans change.",
    tooMany: "You've signed up several times in the last hour. Please try again later.",
  },
  podcast: {
    title: "Podcast",
    lead: "Pick one of the times the team has set. A resident picks the same time, and you meet and record a conversation together.",
    none: "No open podcast times right now. Please check again soon.",
    place: "Where",
    placesLeft: (n: number) => (n === 1 ? "1 place left for students" : `${n} places left for students`),
    topic: "Topic",
    language: "Language",
    pending: "When a resident has chosen the same time, we'll email you their first name.",
    full: "Sorry, this time is full now.",
    closed: "This time is no longer open.",
    alreadyIn: "This email is already signed up for the podcast. To change your time, cancel with the link in your email first.",
    cancelTitle: "Cancel your podcast time",
    cancel: "Cancel my place",
    cancelled: "Your place was cancelled. Thank you for letting us know.",
    invalid: "This link is not valid any more.",
  },
  digital: {
    title: "Digital support",
    lead: "Residents book a time slot to get help with their phone, WhatsApp, email or online banking. Sign up for a slot to help.",
    none: "No upcoming slots right now. Please check again soon.",
    place: "Where",
    note: "Note",
    helpers: (have: number, need: number) => `Helpers: ${have} of ${need}`,
    residents: (n: number) => (n === 1 ? "1 resident booked" : `${n} residents booked`),
    enoughHelpers: "Enough helpers",
    closed: "Closed",
    pending: "A leader will approve your place, then we'll email you.",
    reminder: "The day before, we'll email you the first names of the residents and what help they need.",
    full: "Sorry, this slot already has enough helpers.",
    alreadyIn: "You're already signed up for this slot.",
    notOpen: "This slot is no longer open.",
    cancelTitle: "Cancel your place",
    cancel: "Cancel my place",
    cancelled: "Your place was cancelled. Thank you for letting us know.",
    cancelTooLate: (hours: number) => `It's less than ${hours} hours before the slot. Please tell a project leader instead.`,
    invalid: "This link is not valid any more.",
  },
  conduct: {
    title: "Code of conduct",
    lead: "For everyone who volunteers with residents.",
    rules: [
      "Be respectful, patient and kind. Let the resident set the pace and explain clearly.",
      "Never ask for, look at or write down passwords, PIN codes or bank details, and never handle money.",
      "Don't accept gifts or payment of any kind.",
      "Meet only in the agreed public or supervised places of the estate.",
      "Don't take photos or recordings of residents without their clear consent.",
      "Keep what residents tell you to yourself, and never share their details.",
      "Report any problem or worry to a project leader straight away (or use \"Report a problem\").",
    ],
  },
  report: {
    title: "Report a problem",
    lead: "Something wrong, unsafe or worrying? Tell us. Only the project's admins will read it.",
    message: "What happened?",
    name: "Your name (optional)",
    contact: "Email or phone, if you'd like an answer (optional)",
    thanks: "Thank you for telling us. A project admin will read it and follow up.",
  },
  privacy: { title: "Privacy notice", draft: "Draft: this notice is waiting for review." },
  manage: {
    title: "Your registration",
    cancel: "Cancel my registration",
    cancelled: "Cancelled. Thanks for letting us know.",
    invalid: "This link is not valid any more.",
    statuses: { confirmed: "Registered", waitlist: "Waiting list", cancelled: "Cancelled" },
  },
} as const;
