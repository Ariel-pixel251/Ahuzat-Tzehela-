import Link from "next/link";
import { CalendarIcon, MicIcon, PhoneIcon } from "@/components/icons";
import { residentsText as t } from "@/lib/i18n";

const buttons = [
  { href: "/residents/events", label: t.home.buttons.events, Icon: CalendarIcon },
  { href: "/residents/help", label: t.home.buttons.help, Icon: PhoneIcon },
  { href: "/residents/podcast", label: t.home.buttons.podcast, Icon: MicIcon },
];

export default function ResidentsHome() {
  return (
    <>
      {/* no greeting and no long text: the name for screen readers, the tagline once, then the buttons */}
      <h1 className="sr-only">{t.branchName}</h1>
      <p className="mb-8 text-muted">{t.tagline}</p>
      <ul className="space-y-6">
        {buttons.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-[96px] w-full items-center gap-5 rounded-2xl border-4 border-brand bg-brand px-6 py-5 text-2xl font-extrabold text-white hover:bg-brand-dark"
            >
              <Icon className="size-12 shrink-0" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
