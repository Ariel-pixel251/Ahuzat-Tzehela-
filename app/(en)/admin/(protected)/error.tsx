"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { Notice } from "@/components/ui";

/** Shown instead of a broken admin page, e.g. when the database isn't reachable. */
export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  // ask the server again (reset alone would only redraw the error)
  const retry = () => startTransition(() => {
    router.refresh();
    reset();
  });
  return (
    <Notice kind="bad">
      <p className="font-bold">This admin page couldn&apos;t load.</p>
      <p className="mt-1">The most common reason is a database problem: the database didn&apos;t answer in time, or DATABASE_URL is missing or wrong for this deployment. Trying again usually works.</p>
      <p className="mt-3 flex flex-wrap gap-4">
        <Link href="/admin/setup" className="font-bold underline">Open the setup check</Link>
        <button type="button" onClick={retry} className="font-bold underline">Try again</button>
      </p>
    </Notice>
  );
}
