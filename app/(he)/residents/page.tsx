import Link from "next/link";
import { CalendarIcon, CallIcon, LectureIcon, MicIcon, PhoneIcon, TicketIcon } from "@/components/icons";
import { residentsText as t } from "@/lib/i18n";

const buttons = [
  { href: "/residents/events", label: t.home.buttons.events, Icon: CalendarIcon },
  { href: "/residents/help", label: t.home.buttons.help, Icon: PhoneIcon },
  { href: "/residents/register", label: t.home.buttons.register, Icon: TicketIcon },
  { href: "/residents/podcast", label: t.home.buttons.podcast, Icon: MicIcon },
  { href: "/residents/lecture", label: t.home.buttons.lecture, Icon: LectureIcon },
  { href: "/residents/callback", label: t.home.buttons.callback, Icon: CallIcon },
];

const more = [
  { href: "/residents/lessons", label: t.home.more.lessons },
  { href: "/residents/courses", label: t.home.more.courses },
  { href: "/residents/status", label: t.home.more.status },
  { href: "/residents/privacy", label: t.home.more.privacy },
];

export default function ResidentsHome() {
  return (
    <>
      <h1 className="mb-6 text-4xl font-extrabold">{t.home.title}</h1>
      <ul className="space-y-4">
        {buttons.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-[88px] w-full items-center gap-4 rounded-2xl border-4 border-brand bg-brand px-5 py-4 text-2xl font-extrabold text-white hover:bg-brand-dark"
            >
              <Icon className="size-11" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <nav aria-label={t.home.moreLabel} className="mt-10">
        <ul className="flex flex-wrap gap-x-6 gap-y-3 text-xl">
          {more.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} className="inline-flex min-h-14 items-center font-bold text-brand underline underline-offset-4">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
