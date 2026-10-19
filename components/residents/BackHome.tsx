"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui";

/** "חזרה לדף הראשי": on every resident page except the home page itself. */
export function BackHome({ label }: { label: string }) {
  if (usePathname() === "/residents") return null;
  return (
    <Link href="/residents" className={`${buttonClass.secondary} min-h-14`}>
      <HomeIcon className="size-7" />
      {label}
    </Link>
  );
}
