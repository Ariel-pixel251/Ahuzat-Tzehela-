import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail, supabaseAuthConfigured, supabaseServer } from "@/lib/auth/admin";

/** Supabase magic-link landing: exchanges the code for a session cookie. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!supabaseAuthConfigured() || !code) return NextResponse.redirect(new URL("/admin/login?error=1", request.url));
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !isAdminEmail(data.user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/admin/login?error=1", request.url));
  }
  return NextResponse.redirect(new URL("/admin", request.url));
}
