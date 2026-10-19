import { residentsText, type Locale } from "@/lib/i18n";
import type { Message } from "./index";

// Short, plain messages. Hebrew for residents, English for students.

const sign = { en: "\n\nAhuzat Tzahala × EMIS", he: `\n\n${residentsText.brand}` };

export const templates = {
  eventConfirmation(locale: Locale, p: { name: string; title: string; when: string; waitlist: boolean; code: string; manageUrl?: string | null }): Message {
    if (locale === "he") {
      return {
        subject: p.waitlist ? `רשימת המתנה: ${p.title}` : `נרשמתם: ${p.title}`,
        body:
          `שלום ${p.name},\n` +
          (p.waitlist
            ? `האירוע "${p.title}" (${p.when}) מלא כרגע. רשמנו אתכם לרשימת המתנה, ונודיע אם יתפנה מקום.`
            : `נרשמתם ל"${p.title}", ${p.when}. נתראה!`) +
          `\nקוד הבקשה: ${p.code}` +
          (p.manageUrl ? `\nלביטול: ${p.manageUrl}` : "") +
          sign.he,
      };
    }
    return {
      subject: p.waitlist ? `Waiting list: ${p.title}` : `You're registered: ${p.title}`,
      body:
        `Hi ${p.name},\n\n` +
        (p.waitlist
          ? `"${p.title}" (${p.when}) is full, so you're on the waiting list. We'll let you know if a place opens up.`
          : `You're registered for "${p.title}", ${p.when}. See you there!`) +
        `\nReference: ${p.code}` +
        (p.manageUrl ? `\n\nCan't come? Cancel here: ${p.manageUrl}` : "") +
        sign.en,
    };
  },

  promotedFromWaitlist(locale: Locale, p: { name: string; title: string; when: string }): Message {
    return locale === "he"
      ? { subject: `התפנה מקום: ${p.title}`, body: `שלום ${p.name},\nהתפנה מקום! אתם רשומים ל"${p.title}", ${p.when}.${sign.he}` }
      : { subject: `A place opened up: ${p.title}`, body: `Hi ${p.name},\n\nA place opened up, so you're now registered for "${p.title}", ${p.when}.${sign.en}` };
  },

  eventReminder(locale: Locale, p: { name: string; title: string; when: string }): Message {
    return locale === "he"
      ? { subject: `תזכורת: ${p.title} מחר`, body: `שלום ${p.name},\nתזכורת: מחר "${p.title}", ${p.when}. נתראה!${sign.he}` }
      : { subject: `Reminder: ${p.title} tomorrow`, body: `Hi ${p.name},\n\nA reminder: "${p.title}" is tomorrow, ${p.when}. See you there!${sign.en}` };
  },

  /** Bilingual, because it goes to everyone registered for the event. */
  eventCancelled(p: { name: string; titleEn: string; titleHe: string; whenEn: string; whenHe: string }): Message {
    return {
      subject: `Cancelled / בוטל: ${p.titleEn}`,
      body:
        `Hi ${p.name},\n"${p.titleEn}" (${p.whenEn}) has been cancelled. Sorry, and thank you for registering.\n\n` +
        `שלום ${p.name},\nהאירוע "${p.titleHe}" (${p.whenHe}) בוטל. סליחה, ותודה שנרשמתם.${sign.he}`,
    };
  },

  residentReceived(p: { name: string; what: string; code: string; manageUrl?: string | null }): Message {
    return {
      subject: `קיבלנו: ${p.what}`,
      body: `שלום ${p.name},\nתודה! קיבלנו את הבקשה (${p.what}). ניצור איתכם קשר בטלפון.\nקוד הבקשה: ${p.code}` +
        (p.manageUrl ? `\nלביטול: ${p.manageUrl}` : "") + sign.he,
    };
  },

  digitalAssignedResident(p: { name: string; volunteer: string }): Message {
    return {
      subject: "מצאנו מתנדב",
      body: `שלום ${p.name},\nמצאנו מתנדב שיעזור לכם: ${p.volunteer}. הוא יתקשר אליכם בקרוב.${sign.he}`,
    };
  },

  /** Contact details are not in the email: they are shown on "My requests" after the code of conduct. */
  digitalAssignedStudent(p: { name: string; resident: string; needs: string; url: string }): Message {
    return {
      subject: `New digital support match: ${p.resident}`,
      body:
        `Hi ${p.name},\n\nYou're matched with ${p.resident} (${p.needs}).\n` +
        `Open My requests to see their phone number, then call within a few days to arrange a time:\n${p.url}${sign.en}`,
    };
  },

  podcastJoined(locale: Locale, p: { name: string; code: string; manageUrl?: string | null }): Message {
    return locale === "he"
      ? {
          subject: "נרשמתם לפודקאסט",
          body: `שלום ${p.name},\nתודה שנרשמתם לפודקאסט! נחפש לכם שותף.\nקוד הבקשה: ${p.code}` +
            (p.manageUrl ? `\nהדף שלכם: ${p.manageUrl}` : "") + sign.he,
        }
      : {
          subject: "Your podcast page",
          body: `Hi ${p.name},\n\nThanks for joining the podcast project! Your private page (keep this link to yourself):\n${p.manageUrl ?? ""}\n\nThere you can ask someone to pair with you and answer requests.${sign.en}`,
        };
  },

  podcastPairRequest(locale: Locale, p: { name: string; from: string; manageUrl?: string | null }): Message {
    return locale === "he"
      ? { subject: "בקשה לפודקאסט", body: `שלום ${p.name},\n${p.from} רוצה להקליט איתכם פודקאסט. ניצור קשר כדי לתאם.${sign.he}` }
      : {
          subject: `${p.from} wants to pair with you`,
          body: `Hi ${p.name},\n\n${p.from} asked to be your podcast partner. Open your podcast page (the link from your sign-up email) to accept or decline.${sign.en}`,
        };
  },

  podcastPaired(locale: Locale, p: { name: string; partner: string; partnerContact: string }): Message {
    return locale === "he"
      ? { subject: "יש לכם שותף לפודקאסט", body: `שלום ${p.name},\nמצאנו לכם שותף לפודקאסט: ${p.partner}. ניצור קשר כדי לתאם הקלטה.${sign.he}` }
      : {
          subject: `Podcast pair: ${p.partner}`,
          body: `Hi ${p.name},\n\nYou're paired with ${p.partner} for the podcast.\nContact: ${p.partnerContact}\n\nGet in touch to plan your first recording.${sign.en}`,
        };
  },

  lessonMatched(locale: Locale, p: { name: string; other: string; topic: string; contact: string }): Message {
    return locale === "he"
      ? { subject: "מצאנו שיעור", body: `שלום ${p.name},\nמצאנו מי שילמד אתכם ${p.topic}: ${p.other}. ניצור קשר כדי לתאם.${sign.he}` }
      : {
          subject: `Lesson match: ${p.other}`,
          body: `Hi ${p.name},\n\nYou're matched to teach ${p.topic} to ${p.other}.\nContact: ${p.contact}\n\nPlease call to arrange a time.${sign.en}`,
        };
  },

  studentSignIn(p: { name: string; url: string }): Message {
    return {
      subject: "Your sign-in link",
      body: `Hi ${p.name},\n\nUse this link to sign in (valid for 30 minutes, works once):\n${p.url}\n\nIf you didn't ask for it, ignore this email.${sign.en}`,
    };
  },
};
