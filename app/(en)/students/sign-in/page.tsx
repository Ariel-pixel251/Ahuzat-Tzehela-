import type { Metadata } from "next";
import { SignInForm } from "@/components/students/SignInForm";
import { PageTitle } from "@/components/ui";
import { studentsText as t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.signIn.title };

export default function SignInPage() {
  return (
    <>
      <PageTitle lead={t.signIn.lead}>{t.signIn.title}</PageTitle>
      <SignInForm />
    </>
  );
}
