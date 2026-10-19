import { DAY_PARTS, DAYS, DIGITAL_NEEDS, optionLabel } from "@/config/options";
import { languageName } from "@/config/languages";
import type { PublicDigitalRequest } from "@/lib/db/digital";
import { studentsText as t } from "@/lib/i18n";

/** What a student sees about a request before taking it: no phone, no email, no surname. */
export function DigitalRequestSummary({ r }: { r: Pick<PublicDigitalRequest, "needs" | "needs_other" | "language" | "preferred_days" | "preferred_parts"> }) {
  const times = [
    ...r.preferred_days.map((d) => optionLabel(DAYS, d, "en")),
    ...r.preferred_parts.map((p) => optionLabel(DAY_PARTS, p, "en").toLowerCase()),
  ].join(", ");
  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      <dt className="font-bold">{t.digital.needs}</dt>
      <dd>
        {r.needs.map((n) => optionLabel(DIGITAL_NEEDS, n, "en")).join(", ")}
        {r.needs_other ? ` (${r.needs_other})` : ""}
      </dd>
      <dt className="font-bold">{t.digital.language}</dt>
      <dd>{languageName(r.language, "en")}</dd>
      {times && (
        <>
          <dt className="font-bold">{t.digital.times}</dt>
          <dd>{times}</dd>
        </>
      )}
    </dl>
  );
}
