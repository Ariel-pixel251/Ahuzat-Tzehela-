import { BRAND } from "@/config/brand";
import type { Locale } from "@/lib/i18n";
import type { Message } from "./index";

// Short, plain messages. Hebrew for residents, English for students. Fixed texts: only the
// values below are filled in, and each one is cleaned first (no line breaks or control
// characters, limited length), since names and event titles come from people and the calendar.

const sign = { en: `\n\n${BRAND.en}`, he: `\n\n${BRAND.he}` };

/** One line of plain text: control characters and line breaks removed, length limited. */
export function clean(value: string | null | undefined, max = 200): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** A subject line: cleaned, so it can never add an email header. */
const subject = (s: string) => clean(s, 150);

export const templates = {
  eventConfirmation(locale: Locale, p: { name: string; title: string; when: string; waitlist: boolean; code: string; manageUrl?: string | null }): Message {
    const [name, title, when] = [clean(p.name, 100), clean(p.title), clean(p.when)];
    if (locale === "he") {
      return {
        subject: subject(p.waitlist ? `רשימת המתנה: ${title}` : `נרשמתם: ${title}`),
        body:
          `שלום ${name},\n` +
          (p.waitlist
            ? `האירוע "${title}" (${when}) מלא כרגע. רשמנו אתכם לרשימת המתנה, ונודיע אם יתפנה מקום.`
            : `נרשמתם ל"${title}", ${when}. נתראה!`) +
          `\nקוד הבקשה: ${clean(p.code, 4)}` +
          (p.manageUrl ? `\nלביטול: ${p.manageUrl}` : "") +
          sign.he,
      };
    }
    return {
      subject: subject(p.waitlist ? `Waiting list: ${title}` : `You're registered: ${title}`),
      body:
        `Hi ${name},\n\n` +
        (p.waitlist
          ? `"${title}" (${when}) is full, so you're on the waiting list. We'll let you know if a place opens up.`
          : `You're registered for "${title}", ${when}. See you there!`) +
        `\nReference: ${clean(p.code, 4)}` +
        (p.manageUrl ? `\n\nCan't come? Cancel here: ${p.manageUrl}` : "") +
        sign.en,
    };
  },

  promotedFromWaitlist(locale: Locale, p: { name: string; title: string; when: string }): Message {
    const [name, title, when] = [clean(p.name, 100), clean(p.title), clean(p.when)];
    return locale === "he"
      ? { subject: subject(`התפנה מקום: ${title}`), body: `שלום ${name},\nהתפנה מקום! אתם רשומים ל"${title}", ${when}.${sign.he}` }
      : { subject: subject(`A place opened up: ${title}`), body: `Hi ${name},\n\nA place opened up, so you're now registered for "${title}", ${when}.${sign.en}` };
  },

  eventReminder(locale: Locale, p: { name: string; title: string; when: string }): Message {
    const [name, title, when] = [clean(p.name, 100), clean(p.title), clean(p.when)];
    return locale === "he"
      ? { subject: subject(`תזכורת: ${title} מחר`), body: `שלום ${name},\nתזכורת: מחר "${title}", ${when}. נתראה!${sign.he}` }
      : { subject: subject(`Reminder: ${title} tomorrow`), body: `Hi ${name},\n\nA reminder: "${title}" is tomorrow, ${when}. See you there!${sign.en}` };
  },

  /** Bilingual, because it goes to everyone registered for the event. */
  eventCancelled(p: { name: string; titleEn: string; titleHe: string; whenEn: string; whenHe: string }): Message {
    const name = clean(p.name, 100);
    return {
      subject: subject(`Cancelled / בוטל: ${clean(p.titleEn)}`),
      body:
        `Hi ${name},\n"${clean(p.titleEn)}" (${clean(p.whenEn)}) has been cancelled. Sorry, and thank you for registering.\n\n` +
        `שלום ${name},\nהאירוע "${clean(p.titleHe)}" (${clean(p.whenHe)}) בוטל. סליחה, ותודה שנרשמתם.${sign.he}`,
    };
  },

  residentReceived(p: { name: string; what: string; code?: string }): Message {
    return {
      subject: subject(`קיבלנו: ${clean(p.what)}`),
      body:
        `שלום ${clean(p.name, 100)},\nתודה! קיבלנו את הבקשה (${clean(p.what)}). ניצור איתכם קשר בטלפון.` +
        (p.code ? `\nקוד הבקשה: ${clean(p.code, 4)}` : "") +
        sign.he,
    };
  },

  // ---------------------------------------------------------------- digital support slots

  slotBooked(p: { name: string; slot: string; code: string; manageUrl?: string | null }): Message {
    return {
      subject: "שמרנו לכם מקום לעזרה עם הטלפון או המחשב",
      body:
        `שלום ${clean(p.name, 100)},\nשמרנו לכם מקום: ${clean(p.slot, 300)}.\nמתנדב יחכה לכם שם.` +
        `\nקוד הבקשה: ${clean(p.code, 4)}` +
        (p.manageUrl ? `\nלביטול: ${p.manageUrl}` : "\nלביטול, השיבו להודעה הזו וכתבו את הקוד.") +
        sign.he,
    };
  },

  slotVolunteered(p: { name: string; slot: string; pending: boolean; url: string }): Message {
    return {
      subject: subject(p.pending ? "Digital support: waiting for approval" : "Digital support: you're signed up"),
      body:
        `Hi ${clean(p.name, 100)},\n\n` +
        (p.pending
          ? `Thanks for volunteering for ${clean(p.slot, 300)}. A leader will approve your place soon.`
          : `You're signed up to help on ${clean(p.slot, 300)}. Thank you!`) +
        `\n\nYour slots, the residents' needs and (48 hours before) their phone numbers: ${p.url}${sign.en}`,
    };
  },

  slotReminder(locale: Locale, p: { name: string; slot: string }): Message {
    return locale === "he"
      ? { subject: "תזכורת: עזרה עם הטלפון או המחשב מחר", body: `שלום ${clean(p.name, 100)},\nתזכורת: מחר, ${clean(p.slot, 300)}. נתראה!${sign.he}` }
      : { subject: "Reminder: digital support tomorrow", body: `Hi ${clean(p.name, 100)},\n\nA reminder: you're helping tomorrow, ${clean(p.slot, 300)}. Thank you!${sign.en}` };
  },

  slotChanged(locale: Locale, p: { name: string; before: string; after: string }): Message {
    return locale === "he"
      ? {
          subject: "שינוי במועד העזרה עם הטלפון או המחשב",
          body: `שלום ${clean(p.name, 100)},\nהמועד השתנה.\nבמקום: ${clean(p.before, 300)}\nעכשיו: ${clean(p.after, 300)}\nאם לא מתאים לכם, השיבו להודעה הזו.${sign.he}`,
        }
      : {
          subject: "Digital support: your slot changed",
          body: `Hi ${clean(p.name, 100)},\n\nYour slot changed.\nWas: ${clean(p.before, 300)}\nNow: ${clean(p.after, 300)}\nIf you can't make it, please cancel under My sign-ups.${sign.en}`,
        };
  },

  slotCancelled(locale: Locale, p: { name: string; slot: string }): Message {
    return locale === "he"
      ? { subject: "המועד בוטל", body: `שלום ${clean(p.name, 100)},\nהמועד ${clean(p.slot, 300)} בוטל. סליחה! נשמח לשמור לכם מועד אחר.${sign.he}` }
      : { subject: "Digital support: slot cancelled", body: `Hi ${clean(p.name, 100)},\n\nThe slot on ${clean(p.slot, 300)} has been cancelled. Thank you for volunteering.${sign.en}` };
  },

  // ---------------------------------------------------------------- podcast

  podcastJoined(locale: Locale, p: { name: string; code: string; when?: string | null; manageUrl?: string | null }): Message {
    const when = p.when ? clean(p.when) : null;
    return locale === "he"
      ? {
          subject: "נרשמתם לפודקאסט",
          body:
            `שלום ${clean(p.name, 100)},\nתודה שנרשמתם לפודקאסט! נחפש לכם שותף.` +
            (when ? `\nהמועד שבחרתם: ${when}.` : "") +
            `\nקוד הבקשה: ${clean(p.code, 4)}` +
            sign.he,
        }
      : {
          subject: "Your podcast page",
          body:
            `Hi ${clean(p.name, 100)},\n\nThanks for joining the podcast project!` +
            (when ? ` Your time: ${when}.` : "") +
            ` Your private page (keep this link to yourself):\n${p.manageUrl ?? ""}\n\nThere you can ask someone to pair with you and answer requests.${sign.en}`,
        };
  },

  podcastPairRequest(locale: Locale, p: { name: string; from: string }): Message {
    return locale === "he"
      ? { subject: "בקשה לפודקאסט", body: `שלום ${clean(p.name, 100)},\n${clean(p.from, 100)} רוצה להקליט איתכם פודקאסט. ניצור קשר כדי לתאם.${sign.he}` }
      : {
          subject: subject(`${clean(p.from, 100)} wants to pair with you`),
          body: `Hi ${clean(p.name, 100)},\n\n${clean(p.from, 100)} asked to be your podcast partner. Open your podcast page (the link from your sign-up email) to accept or decline.${sign.en}`,
        };
  },

  podcastPaired(locale: Locale, p: { name: string; partner: string; partnerContact: string }): Message {
    return locale === "he"
      ? { subject: "יש לכם שותף לפודקאסט", body: `שלום ${clean(p.name, 100)},\nמצאנו לכם שותף לפודקאסט: ${clean(p.partner, 100)}. ניצור קשר כדי לתאם הקלטה.${sign.he}` }
      : {
          subject: subject(`Podcast pair: ${clean(p.partner, 100)}`),
          body: `Hi ${clean(p.name, 100)},\n\nYou're paired with ${clean(p.partner, 100)} for the podcast.\nContact: ${clean(p.partnerContact)}\n\nGet in touch to plan your first recording.${sign.en}`,
        };
  },

  /** Sent when an admin makes the pair (and ticks "send them a message"): who, and when they meet. */
  podcastPairedByAdmin(locale: Locale, p: { name: string; partner: string; when: string | null; place: string | null; partnerContact?: string }): Message {
    const [name, partner] = [clean(p.name, 100), clean(p.partner, 100)];
    const when = p.when ? clean(p.when) : null;
    const place = p.place ? clean(p.place) : null;
    if (locale === "he") {
      return {
        subject: "יש לכם שותף לפודקאסט",
        body:
          `שלום ${name},\nהשותף שלכם לפודקאסט: ${partner}.` +
          (when ? `\nנפגשים: ${when}${place ? `, ${place}` : ""}.` : "\nניצור קשר כדי לתאם מתי נפגשים.") +
          sign.he,
      };
    }
    return {
      subject: subject(`Podcast pair: ${partner}`),
      body:
        `Hi ${name},\n\nYou're paired with ${partner} for the podcast.` +
        (when ? `\nYou meet: ${when}${place ? `, ${place}` : ""}.` : "\nWe'll be in touch to arrange when you meet.") +
        (p.partnerContact ? `\nContact: ${clean(p.partnerContact)}` : "") +
        sign.en,
    };
  },

  /** Sent when an admin puts a student into a digital support slot: when, where, and who is booked. */
  helperAssigned(p: { name: string; slot: string; residents: string[]; url: string }): Message {
    const residents = p.residents.map((r) => clean(r, 50)).join(", ");
    return {
      subject: "Digital support: you're helping",
      body:
        `Hi ${clean(p.name, 100)},\n\nYou're helping with digital support on ${clean(p.slot, 300)}.` +
        `\n${residents ? `Residents booked so far: ${residents}.` : "No residents have booked yet."}` +
        `\n\nThank you! See your slots here: ${p.url}${sign.en}`,
    };
  },

  studentSignIn(p: { name: string; url: string }): Message {
    return {
      subject: "Your sign-in link",
      body: `Hi ${clean(p.name, 100)},\n\nUse this link to sign in (valid for 30 minutes, works once):\n${p.url}\n\nIf you didn't ask for it, ignore this email.${sign.en}`,
    };
  },
};
