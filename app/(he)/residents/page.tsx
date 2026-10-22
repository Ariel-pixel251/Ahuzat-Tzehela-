import Link from "next/link";
import { CalendarIcon, MicIcon, PhoneIcon } from "@/components/icons";
import { Wordmark } from "@/components/Wordmark";
import { residentsText as t } from "@/lib/i18n";

const buttons = [
  { href: "/residents/events", label: t.home.buttons.events, Icon: CalendarIcon },
  { href: "/residents/help", label: t.home.buttons.help, Icon: PhoneIcon },
  { href: "/residents/podcast", label: t.home.buttons.podcast, Icon: MicIcon },
];

export default function ResidentsHome() {
  return (
    <>
      <Wordmark name={t.brand} subtitle={t.subtitle} className="mb-8" />
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
    </>
  );
}
