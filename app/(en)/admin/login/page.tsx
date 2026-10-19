import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { devAdminLogin, sendAdminLink } from "@/app/actions/admin";
import { ActionForm, TextField } from "@/components/forms";
import { buttonClass, Notice, PageTitle } from "@/components/ui";
import Link from "next/link";
import { adminEmails, devLoginAllowed, getAdmin, supabaseAuthConfigured } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "Admin sign-in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAdmin()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-12">
      <PageTitle lead="Admins and leaders sign in with a magic link sent to their email.">Admin sign-in</PageTitle>
      {error && (
        <Notice kind="bad" className="mb-4">
          That sign-in link didn&apos;t work. Links work once, for one hour, and only in the same browser where you asked
          for them (not on another phone or computer). Please request a new one here.
        </Notice>
      )}
      {supabaseAuthConfigured() ? (
        <ActionForm action={sendAdminLink} submitLabel="Email me a sign-in link" pendingLabel="Sending…">
          <TextField name="email" label="Email" type="email" autoComplete="email" required />
        </ActionForm>
      ) : devLoginAllowed() ? (
        <>
          <Notice kind="warn" className="mb-4">
            Supabase Auth isn&apos;t configured, so local development uses a dev sign-in (disabled in production).
          </Notice>
          <form action={devAdminLogin}>
            <button type="submit" className={buttonClass.primary}>Dev sign-in</button>
          </form>
        </>
      ) : (
        <Notice kind="bad">Admin sign-in isn&apos;t configured on this deployment. Open the setup check below to see what&apos;s missing.</Notice>
      )}
      {supabaseAuthConfigured() && adminEmails().length === 0 && (
        <Notice kind="bad" className="mt-4">No admin emails are set up yet (ADMIN_EMAILS), so no sign-in link can be sent.</Notice>
      )}
      <p className="mt-8">
        <Link href="/admin/setup" className="font-bold underline">
          Something not working? Open the setup check
        </Link>
      </p>
    </main>
  );
}
