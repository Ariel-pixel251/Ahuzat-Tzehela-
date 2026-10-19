"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Student portal navigation; the current page is marked for screen readers. */
export function Nav({ items, label }: { items: { href: string; label: string }[]; label: string }) {
  const path = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-x-1 gap-y-1">
        {items.map((i) => {
          const current = i.href === "/students" ? path === i.href : path.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-lg px-3 font-bold ${current ? "bg-brand text-white" : "text-brand hover:bg-brand-soft"}`}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
