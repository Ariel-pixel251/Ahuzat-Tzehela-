import type { Metadata } from "next";
import { PrintButton } from "@/components/PrintButton";
import { QrCode } from "@/components/QrCode";
import { eventForm, getCalendar } from "@/lib/calendar";
import { formatEventWhen } from "@/lib/i18n/format";
import { residentsText as t } from "@/lib/i18n";
import { getBaseUrl } from "@/lib/server";

export const metadata: Metadata = { title: t.print.title };
export const dynamic = "force-dynamic";

/**
 * Large-print A4 sign-up sheet. ?e=key1&e=key2 limits it to chosen events (from the admin
 * sheet generator); otherwise the next registrable events. Paper answers are typed in at
 * /admin/register.
 */
export default async function PrintSheet({ searchParams }: { searchParams: Promise<{ e?: string | string[] }> }) {
  const { e: chosen } = await searchParams;
  const keys = chosen === undefined ? undefined : [chosen].flat().filter(Boolean);
  const { upcoming } = await getCalendar();
  const events = keys?.length
    ? upcoming.filter((e) => keys.includes(e.key))
    : upcoming.filter((e) => eventForm(e) !== null).slice(0, 4);
  const url = `${await getBaseUrl()}/residents/register`;
  return (
    <div className="mx-auto max-w-[190mm] text-[16pt] print:max-w-none">
      <div className="no-print mb-6">
        <PrintButton label={t.events.print} />
      </div>
      <div className="flex items-start justify-between gap-6">
        <h1 className="text-[28pt] font-extrabold leading-tight">{t.print.title}</h1>
        <div className="text-center">
          <QrCode value={url} label={url} className="size-36" />
          <p className="text-[11pt]" dir="ltr">{url.replace(/^https?:\/\//, "")}</p>
        </div>
      </div>
      <p className="mt-2">{t.print.scan}</p>
      {events.map((e) => (
        <section key={e.key} className="mt-6 break-inside-avoid border-t-4 border-ink pt-4">
          <h2 className="text-[22pt] font-extrabold">{e.title.he}</h2>
          <p className="font-bold">{formatEventWhen(e, "he")}{e.location ? ` · ${e.location.he}` : ""}</p>
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr>
                <th className="border-2 border-ink p-2 text-start">{t.print.name}</th>
                <th className="border-2 border-ink p-2 text-start">{t.print.phone}</th>
                <th className="w-32 border-2 border-ink p-2 text-start">{t.print.people}</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className="h-14">
                  <td className="border-2 border-ink" />
                  <td className="border-2 border-ink" />
                  <td className="border-2 border-ink" />
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
