import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { devAdminLogin, sendAdminLink } from "@/app/actions/admin";
import { ActionForm, TextField } from "@/components/forms";
import { buttonClass, Notice, PageTitle } from "@/components/ui";
import { devLoginAllowed, getAdmin, supabaseAuthConfigured } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "Admin sign-in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAdmin()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-12">
      <PageTitle lead="Admins and leaders sign in with a magic link sent to their email.">Admin sign-in</PageTitle>
      {error && <Notice kind="bad" className="mb-4">That sign-in link didn&apos;t work. Please request a new one.</Notice>}
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
        <Notice kind="bad">Admin sign-in is not configured: set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and ADMIN_EMAILS.</Notice>
      )}
    </main>
  );
}
