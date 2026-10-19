import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { deploymentEnv } from "@/lib/env";
import { setupChecks, type CheckStatus } from "@/lib/setup-check";

export const metadata: Metadata = { title: "Setup check", robots: { index: false } };
export const dynamic = "force-dynamic";

const LOOK: Record<CheckStatus, { icon: string; label: string; box: string }> = {
  ok: { icon: "✓", label: "Working", box: "border-ok bg-ok-soft" },
  info: { icon: "i", label: "Good to know", box: "border-brand bg-brand-soft" },
  warn: { icon: "!", label: "Needs attention", box: "border-warn bg-warn-soft" },
  bad: { icon: "✗", label: "Not working", box: "border-bad bg-bad-soft" },
};

/** Public page that explains what's configured on this deployment. It never shows secret values. */
export default async function SetupCheck() {
  const order: CheckStatus[] = ["bad", "warn", "info", "ok"];
  const checks = [...(await setupChecks())].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-10">
      <PageTitle lead={`This deployment: ${deploymentEnv()}. Settings changed in Vercel only apply after a redeploy.`}>
        Setup check
      </PageTitle>
      <ul className="space-y-3">
        {checks.map((c) => (
          <li key={c.name} className={`rounded-xl border-s-8 p-4 ${LOOK[c.status].box}`}>
            <p className="font-bold">
              <span aria-hidden="true" className="me-2 inline-block w-5 text-center">
                {LOOK[c.status].icon}
              </span>
              {c.name} <span className="sr-only">: {LOOK[c.status].label}</span>
            </p>
            <p className="mt-1">{c.detail}</p>
            {c.fix && (
              <p className="mt-1">
                <span className="font-bold">What to do: </span>
                {c.fix}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-8">
        <Link href="/admin/login" className="font-bold underline">
          Back to admin sign-in
        </Link>
      </p>
    </main>
  );
}
