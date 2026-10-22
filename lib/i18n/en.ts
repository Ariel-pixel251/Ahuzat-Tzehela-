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
  tagline: BRAND.tagline.en,
  nav: {
    label: "Main",
    home: "Home",
    events: "Events",
    digital: "Digital support",
    podcast: "Podcast",
    mine: "My sign-ups",
  },
  skip: "Skip to content",
  footer: { privacy: "Privacy notice", report: "Report a problem", residents: "פורטל הדיירים" },
  home: {
    keyEvents: "Coming up",
    allEvents: "All events",
    cards: {
      events: { title: "Events", text: "Game nights, language nights, parties and lectures. Register here." },
      digital: { title: "Digital support", text: "Choose a time slot to help residents with their phones and computers." },
      podcast: { title: "Podcast", text: "Pair up with a resident and record conversations together." },
      mine: { title: "My sign-ups", text: "Your slots, your profile and the code of conduct." },
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
  podcast: {
    title: "Podcast pairs",
    lead: "Sign up, then pair up with a resident (or anyone) to record conversations together.",
    signUpTitle: "Sign up",
    topics: "Topics I'm interested in",
    language: "Preferred language",
    time: "When can you meet?",
    timeHint: "The times the team has set. Your partner chooses the same time.",
    arrangeByMessage: "None of these fit: arrange a time with the team",
    yourTime: "Your time",
    joined: "You're signed up! We've emailed you a private link to your podcast page, where you can ask another student to pair with you, or wait for the team to pair you with a resident.",
    openPage: "Open my podcast page",
    lookingTitle: "Looking for a partner",
    lookingNone: "Nobody is waiting right now.",
    statuses: { looking: "Looking", requested: "Pair requested", paired: "Paired" },
    portals: { student: "Student", resident: "Resident" },
    manageTitle: "My podcast page",
    invalid: "This link is not valid any more.",
    you: "You",
    partner: "Your partner",
    noPartner: "You don't have a partner yet. Choose someone from the list and send a request.",
    request: "Ask to pair",
    requested: "Request sent. You'll be paired when they accept.",
    alreadyRequested: "You've already asked them.",
    paired: "You're paired! We've let you both know.",
    unavailable: "That person is no longer available.",
    incoming: "Wants to pair with you",
    outgoing: "Waiting for their answer",
    accept: "Accept",
    decline: "Decline",
    declined: "Declined.",
    leave: "Leave the podcast project",
    left: "You've left the podcast project.",
  },
  digital: {
    title: "Digital support",
    lead: "Residents book a time slot to get help with their phone, WhatsApp, email or online banking. Choose a slot to volunteer as a helper.",
    none: "No upcoming slots right now. Please check again soon.",
    when: "When",
    place: "Where",
    note: "Note",
    helpers: (have: number, need: number) => `Helpers: ${have} of ${need}`,
    residents: (n: number) => (n === 1 ? "1 resident booked" : `${n} residents booked`),
    volunteer: "Volunteer for this slot",
    enoughHelpers: "Enough helpers",
    youreIn: "You're signed up",
    youreWaiting: "Waiting for a leader's approval",
    closed: "Closed",
    volunteered: "Thank you! You're signed up for this slot. See it under My sign-ups.",
    pending: "Thank you! A leader will approve your place, then it will appear as confirmed under My sign-ups.",
    full: "Sorry, this slot already has enough helpers.",
    alreadyIn: "You're already signed up for this slot.",
    notOpen: "This slot is no longer open.",
    signInToVolunteer: "Sign in with your school email to volunteer.",
    profileNeeded: "Before you volunteer, please fill in your age group (and, if you're under 18, a parent or guardian) under My sign-ups.",
    tooMany: "You've signed up for several slots in the last hour. Please try again later.",
    signIn: "Sign in",
    signOut: "Sign out",
    signedInAs: (name: string) => `Signed in as ${name}`,
  },
  mine: {
    title: "My sign-ups",
    slotsTitle: "My digital support slots",
    none: "You haven't signed up for any slots yet.",
    browse: "Choose a slot",
    statuses: { confirmed: "Confirmed", pending: "Waiting for approval" },
    cancel: "Cancel my place",
    cancelled: "Your place was cancelled. Thank you for letting us know.",
    cancelTooLate: (hours: number) => `It's less than ${hours} hours before the slot. Please tell a project leader instead.`,
    residentsTitle: "Residents booked into this slot",
    noResidents: "No residents have booked this slot yet.",
    needs: "Needs help with",
    phone: "Phone",
    phoneLater: (hours: number) =>
      `Phone numbers appear here ${hours} hours before the slot (after you accept the code of conduct). Please call only to confirm the meeting.`,
    conductTitle: "Code of conduct",
    conduct: [
      "Be respectful, patient and kind. Let the resident set the pace and explain clearly.",
      "Never ask for, look at or write down passwords, PIN codes or bank details, and never handle money.",
      "Don't accept gifts or payment of any kind.",
      "Meet only in the agreed public or supervised places of the estate.",
      "Don't take photos or recordings of residents without their clear consent.",
      "Use residents' contact details only for your slot, and never share them.",
      "Report any problem or worry to a project leader straight away (or use \"Report a problem\").",
    ],
    conductAccept: "I have read and accept the code of conduct",
    conductButton: "Accept the code of conduct",
    conductAccepted: "You've accepted the code of conduct.",
    profileTitle: "About you",
    profileLead: "We ask this before you volunteer. Under-18s need a parent or guardian's okay.",
    ageGroup: "Age group",
    guardianName: "Parent or guardian's name",
    guardianPhone: "Parent or guardian's phone",
    guardianConfirm: "My parent or guardian knows about my volunteering and agrees to it.",
    guardianRequired: "Under 18: please fill in your parent or guardian's name and phone, and tick the box.",
    saveProfile: "Save",
    profileSaved: "Saved. Thank you!",
    eventsTitle: "My event registrations",
    noEvents: "No event registrations with this email.",
    podcastTitle: "My podcast sign-up",
    podcastPage: "Open my podcast page (the link is in your sign-up email)",
    eventStatuses: { confirmed: "Registered", waitlist: "Waiting list", cancelled: "Cancelled" },
  },
  signIn: {
    title: "Sign in",
    lead: "No password needed. Enter your details and we'll email you a sign-in link.",
    send: "Email me a link",
    sent: "Check your email for a sign-in link (valid for 30 minutes).",
    devLink: "Email isn't set up on this server, so here is your link:",
    schoolEmailOnly: (domains: string) => `Please use your school email (${domains}).`,
    tooMany: "We've sent several links already. Please check your inbox or wait 15 minutes.",
    confirmTitle: "Finish signing in",
    confirm: "Sign in",
    invalid: "This sign-in link has expired or was already used. Please request a new one.",
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
