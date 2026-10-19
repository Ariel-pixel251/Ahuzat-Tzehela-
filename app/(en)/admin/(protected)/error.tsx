"use client";

import Link from "next/link";
import { Notice } from "@/components/ui";

/** Shown instead of a broken admin page, e.g. when the database isn't reachable. */
export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Notice kind="bad">
      <p className="font-bold">This admin page couldn&apos;t load.</p>
      <p className="mt-1">The most common reason is a database problem (for example DATABASE_URL missing or wrong for this deployment).</p>
      <p className="mt-3 flex flex-wrap gap-4">
        <Link href="/admin/setup" className="font-bold underline">Open the setup check</Link>
        <button type="button" onClick={reset} className="font-bold underline">Try again</button>
      </p>
    </Notice>
  );
}
