// English text for the student portal, and the shape of the text both portals share.

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
    unavailable: "Sign-ups are not available right now. Please try again later.",
    rateLimited: "Too many attempts. Please wait a few minutes and try again.",
    duplicate: "You're already registered for this event.",
    closed: "Registration for this event is closed.",
    notFound: "We couldn't find that event.",
    alreadyJoined: "This email is already signed up for the podcast. Check your inbox for your link.",
  },
};

export const students = {
  brand: "Ahuzat Tzahala × EMIS",
  nav: {
    label: "Main",
    home: "Home",
    schedule: "Timetable",
    digital: "Digital support",
    podcast: "Podcast",
    more: "More",
  },
  skip: "Skip to content",
  home: {
    title: "Volunteer with Ahuzat Tzahala",
    lead: "Activities, events and partnerships between EMIS students and the residents of Ahuzat Tzahala.",
    keyEvents: "Key events",
    allEvents: "Full timetable",
    cards: {
      digital: { title: "Digital support", text: "Help a resident with their phone, WhatsApp or email." },
      podcast: { title: "Podcast pairs", text: "Record conversations with a partner. Find your pair here." },
      lessons: { title: "Private lessons", text: "Teach something you are good at." },
      courses: { title: "Courses and timetable", text: "Courses we recommend for residents, and the weekly timetable." },
      share: { title: "Invite friends", text: "Share the link, the invitation text or the QR poster." },
      visit: { title: "Visit request", text: "Organisations: come and see a day at the estate." },
    },
  },
  schedule: {
    title: "Timetable",
    lead: "Upcoming events. Times are Israel time.",
    none: "No upcoming events yet.",
    offline: "The live calendar couldn't be loaded, so these are the planned events.",
    register: "Register",
    joinPodcast: "Join the podcast",
    digital: "Help with digital support",
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
    role: "How would you like to take part?",
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
    availability: "Availability",
    availabilityHint: "e.g. Tuesdays after school",
    joined: "You're signed up! We've emailed you a private link to your podcast page, where you can ask someone to pair with you.",
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
    lead: "Residents asked for help with their phone, WhatsApp, email and more. Take a request, then call the resident to arrange a visit.",
    none: "No open requests right now. Thank you for checking!",
    take: "Take this request",
    taken: "It's yours! See it under My requests.",
    takenWaiting: "It's yours! A leader will approve the match, then you'll see the contact details.",
    alreadyTaken: "Sorry, someone else just took this request.",
    signInToTake: "Sign in with your email to take requests.",
    myRequests: "My requests",
    needs: "Needs help with",
    language: "Language",
    times: "Good times",
    posted: "Posted",
    signIn: "Sign in",
    signOut: "Sign out",
    signedInAs: (name: string) => `Signed in as ${name}`,
  },
  mine: {
    title: "My requests",
    none: "You haven't taken any requests yet.",
    conductTitle: "Code of conduct",
    conduct: [
      "Be patient, kind and respectful. Speak clearly and let the resident set the pace.",
      "Never ask for or write down passwords, PIN codes or bank details.",
      "Use the resident's contact details only for this request, and don't share them.",
      "Visit in public areas of the estate, and tell a leader if anything worries you.",
    ],
    conductAccept: "I have read and accept the code of conduct",
    conductButton: "Show contact details",
    waitingApproval: "Waiting for a leader to approve this match.",
    contact: "Contact",
    release: "Give back",
    released: "Released. The request is open again.",
    done: "Mark as done",
    markedDone: "Marked as done. Thank you!",
    statuses: { assigned: "Assigned to you", done: "Done" },
  },
  signIn: {
    title: "Sign in",
    lead: "No password needed. Enter your details and we'll email you a sign-in link.",
    send: "Email me a link",
    sent: "Check your email for a sign-in link (valid for 30 minutes).",
    devLink: "Email isn't set up on this server, so here is your link:",
    tooMany: "We've sent several links already. Please check your inbox or wait 15 minutes.",
    confirmTitle: "Finish signing in",
    confirm: "Sign in",
    invalid: "This sign-in link has expired or was already used. Please request a new one.",
  },
  lessons: {
    title: "Private lessons",
    lead: "Tell us what you can teach. A leader will match you with a resident who wants to learn it.",
    topics: "I can teach",
    otherTopic: "Something else I can teach (optional)",
    thanks: "Thank you! A leader will be in touch when there's a match.",
  },
  courses: { title: "Courses and timetable", courses: "Recommended courses", timetable: "Weekly timetable", none: "Nothing here yet." },
  visit: {
    title: "Request a visit",
    lead: "Come and see a day at Ahuzat Tzahala. Tell us about your group and we'll get back to you.",
    organization: "Organisation",
    dates: "Preferred dates",
    groupSize: "Group size",
    thanks: "Thank you! We'll get back to you by email.",
  },
  share: {
    title: "Share and invite",
    lead: "Help us reach more students and residents.",
    link: "Link",
    copy: "Copy",
    copied: "Copied!",
    english: "Invitation (English)",
    hebrew: "Invitation (Hebrew)",
    whatsapp: "Share on WhatsApp",
    email: "Send by email",
    poster: "Printable QR poster",
    inviteEn:
      "Join the Ahuzat Tzahala project! Game nights, language nights, podcast pairs and helping residents with their phones. Sign up here:",
    inviteHe: "הצטרפו לפרויקט אחוזת צהלה! ערבי משחקים, ערבי שפות, פודקאסט ועזרה לדיירים עם הטלפון. להרשמה:",
    posterTitle: "Volunteer at Ahuzat Tzahala",
    posterText: "Scan to see events and sign up",
  },
  privacy: {
    title: "Privacy notice",
    body: [
      "What we collect: your name, email, and phone if you give it, plus what you sign up for.",
      "Who sees it: only the project team (admins and leaders). A resident you're matched with gets your first name; your contact details are shared only for your own match.",
      "Residents' contact details are shown to you only for requests you take, after you accept the code of conduct.",
      "How long: event registrations are deleted 90 days after the event; cancelled requests are deleted.",
      "Your choice: email us or ask a leader to see or delete your details at any time.",
    ],
  },
  manage: {
    title: "Your registration",
    cancel: "Cancel my registration",
    cancelled: "Cancelled. Thanks for letting us know.",
    invalid: "This link is not valid any more.",
    statuses: { confirmed: "Registered", waitlist: "Waiting list", cancelled: "Cancelled" },
  },
  announcement: "Announcement",
  memorialRoles: "How would you like to take part?",
} as const;
