import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail, supabaseAuthConfigured, supabaseServer } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { audit } from "@/lib/db/misc";
import { logError } from "@/lib/log";

/** Supabase magic-link landing: exchanges the code for a session cookie. Redirects only to fixed paths. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const failed = () => NextResponse.redirect(new URL("/admin/login?error=1", request.url));
  if (!supabaseAuthConfigured() || !code || code.length > 200) return failed();
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const email = data.user?.email;
  if (error || !email || !isAdminEmail(email)) {
    await supabase.auth.signOut();
    return failed();
  }
  try {
    await audit(await getDb(), email, "sign_in");
  } catch (err) {
    logError("audit sign-in", err);
  }
  return NextResponse.redirect(new URL("/admin", request.url));
}
