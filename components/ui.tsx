import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Shared building blocks. Sizes are in rem, so the resident portal (22px base) gets large
// targets automatically; minimum heights are in px so they never shrink below the targets.

const base =
  "inline-flex items-center justify-center gap-3 rounded-xl border-2 px-5 font-bold text-center no-underline transition-colors disabled:opacity-60";

export const buttonClass = {
  primary: `${base} min-h-14 border-brand bg-brand text-white hover:bg-brand-dark`,
  secondary: `${base} min-h-14 border-ink bg-white text-ink hover:bg-sand`,
  danger: `${base} min-h-14 border-bad bg-white text-bad hover:bg-bad-soft`,
  small: "inline-flex min-h-10 items-center justify-center rounded-lg border-2 border-ink bg-white px-3 text-sm font-bold hover:bg-sand",
};

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonClass }) {
  return <Link {...props} className={`${buttonClass[variant]} ${className}`} />;
}

export function Notice({ kind = "info", children, className = "" }: { kind?: "info" | "ok" | "bad" | "warn"; children: ReactNode; className?: string }) {
  const styles = {
    info: "border-brand bg-brand-soft",
    ok: "border-ok bg-ok-soft text-ok",
    bad: "border-bad bg-bad-soft text-bad",
    warn: "border-warn bg-warn-soft text-warn",
  }[kind];
  return (
    <div role={kind === "bad" ? "alert" : "status"} className={`rounded-xl border-s-8 p-4 font-medium ${styles} ${className}`}>
      {children}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" | "ok" | "bad" }) {
  const styles = {
    neutral: "border-ink text-ink",
    warn: "border-warn bg-warn-soft text-warn",
    ok: "border-ok bg-ok-soft text-ok",
    bad: "border-bad bg-bad-soft text-bad",
  }[tone];
  return <span className={`inline-block rounded-full border-2 px-3 py-0.5 text-sm font-bold ${styles}`}>{children}</span>;
}

export function Card({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "li" | "article" | "section" }) {
  return <Tag className={`rounded-2xl border-2 border-line bg-white p-5 ${className}`}>{children}</Tag>;
}

export function PageTitle({ children, lead }: { children: ReactNode; lead?: ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="text-3xl font-extrabold leading-tight">{children}</h1>
      {lead && <p className="mt-2 text-muted">{lead}</p>}
    </header>
  );
}
