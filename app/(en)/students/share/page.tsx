import type { Metadata } from "next";
import { CopyButton } from "@/components/CopyButton";
import { QrCode } from "@/components/QrCode";
import { ButtonLink, Card, PageTitle } from "@/components/ui";
import { studentsText as t } from "@/lib/i18n";
import { getBaseUrl } from "@/lib/server";

export const metadata: Metadata = { title: t.share.title };
export const dynamic = "force-dynamic";

export default async function SharePage() {
  const url = await getBaseUrl();
  const texts = [
    { label: t.share.english, text: `${t.share.inviteEn} ${url}`, lang: "en", dir: "ltr" as const },
    { label: t.share.hebrew, text: `${t.share.inviteHe} ${url}`, lang: "he", dir: "rtl" as const },
  ];
  return (
    <>
      <PageTitle lead={t.share.lead}>{t.share.title}</PageTitle>
      <Card className="mb-6">
        <h2 className="text-xl font-extrabold">{t.share.link}</h2>
        <p className="my-2 break-all font-mono">{url}</p>
        <CopyButton text={url} label={t.share.copy} copied={t.share.copied} />
      </Card>
      {texts.map((x) => (
        <Card key={x.lang} className="mb-6">
          <h2 className="text-xl font-extrabold">{x.label}</h2>
          <p lang={x.lang} dir={x.dir} className="my-2 rounded-lg bg-sand p-3">{x.text}</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={x.text} label={t.share.copy} copied={t.share.copied} />
            <a className={`inline-flex min-h-10 items-center rounded-lg border-2 border-ink px-3 text-sm font-bold`} href={`https://wa.me/?text=${encodeURIComponent(x.text)}`} target="_blank" rel="noopener noreferrer">
              {t.share.whatsapp}
            </a>
            <a className={`inline-flex min-h-10 items-center rounded-lg border-2 border-ink px-3 text-sm font-bold`} href={`mailto:?subject=${encodeURIComponent(t.share.posterTitle)}&body=${encodeURIComponent(x.text)}`}>
              {t.share.email}
            </a>
          </div>
        </Card>
      ))}
      <div className="flex flex-wrap items-center gap-6">
        <QrCode value={url} label={url} className="size-40" />
        <ButtonLink href="/students/share/poster">{t.share.poster}</ButtonLink>
      </div>
    </>
  );
}
