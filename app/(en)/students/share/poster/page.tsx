import type { Metadata } from "next";
import { PrintButton } from "@/components/PrintButton";
import { QrCode } from "@/components/QrCode";
import { studentsText as t } from "@/lib/i18n";
import { getBaseUrl } from "@/lib/server";

export const metadata: Metadata = { title: t.share.poster };
export const dynamic = "force-dynamic";

/** A4 poster for the school noticeboard. */
export default async function Poster() {
  const url = await getBaseUrl();
  return (
    <div className="mx-auto flex max-w-[180mm] flex-col items-center text-center">
      <div className="no-print mb-6 self-start">
        <PrintButton label={t.share.poster} />
      </div>
      <h1 className="text-[34pt] font-extrabold leading-tight">{t.share.posterTitle}</h1>
      <p lang="he" dir="rtl" className="mt-2 text-[24pt] font-bold">התנדבות באמיס - אחוזת צהלה - ביחד לדורות</p>
      <QrCode value={url} label={url} className="my-8 size-[110mm]" />
      <p className="text-[18pt]">{t.share.posterText}</p>
      <p className="mt-2 font-mono text-[16pt]">{url.replace(/^https?:\/\//, "")}</p>
    </div>
  );
}
