import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/** Admins (and leaders) are the emails listed in ADMIN_EMAILS, signed in with a Supabase magic link. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined) {
  return Boolean(email) && adminEmails().includes(email!.toLowerCase());
}

export function supabaseAuthConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Local development without Supabase: a "dev sign-in" button (never in production). */
export function devLoginAllowed() {
  return process.env.NODE_ENV !== "production" && !supabaseAuthConfigured();
}

export const DEV_ADMIN_COOKIE = "dev_admin";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // called from a server component: the proxy refreshes the session instead
        }
      },
    },
  });
}

export async function getAdmin(): Promise<{ email: string } | null> {
  if (supabaseAuthConfigured()) {
    const { data } = await (await supabaseServer()).auth.getUser();
    const email = data.user?.email;
    return email && isAdminEmail(email) ? { email } : null;
  }
  if (devLoginAllowed() && (await cookies()).get(DEV_ADMIN_COOKIE)?.value === "1") return { email: "dev-admin@localhost" };
  return null;
}

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
