import Link from "next/link";
import { Checkbox } from "@/components/forms";
import { studentsText as t } from "@/lib/i18n";

/** The required privacy checkbox on every student form. */
export function Consent() {
  return (
    <Checkbox
      name="consent"
      required
      label={
        <>
          {t.form.consent}{" "}
          <Link href="/students/privacy" className="underline">
            {t.form.privacyLink}
          </Link>
        </>
      }
    />
  );
}
