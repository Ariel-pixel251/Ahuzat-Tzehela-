import type { Metadata } from "next";
import { completeSignIn } from "@/app/actions/students";
import { ActionButton } from "@/components/ActionButton";
import { PageTitle } from "@/components/ui";
import { studentsText as t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.signIn.confirmTitle, robots: { index: false } };

/**
 * The emailed link lands here and the student presses a button to sign in. Signing in on a
 * button press (POST) rather than on page load stops email link scanners using up the link.
 */
export default async function AuthPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <>
      <PageTitle>{t.signIn.confirmTitle}</PageTitle>
      <ActionButton action={completeSignIn} fields={{ token }} label={t.signIn.confirm} />
    </>
  );
}
