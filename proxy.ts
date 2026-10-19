import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase-config";

/** Keeps the admin's Supabase Auth session fresh (cookies are refreshed on each /admin request). */
export async function proxy(request: NextRequest) {
  // Supabase falls back to the Site URL ("/") when /admin/auth/callback isn't in its Redirect URLs
  // list; forward a sign-in code (a UUID) or a sign-in error to the admin pages.
  if (request.nextUrl.pathname === "/") {
    const code = request.nextUrl.searchParams.get("code");
    if (code && /^[0-9a-f-]{36}$/i.test(code)) {
      return NextResponse.redirect(new URL(`/admin/auth/callback?code=${code}`, request.url));
    }
    if (request.nextUrl.searchParams.get("error_code")) return NextResponse.redirect(new URL("/admin/login?error=1", request.url));
    return NextResponse.next();
  }
  let response = NextResponse.next({ request });
  const url = supabaseUrl();
  const key = supabasePublicKey();
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = { matcher: ["/", "/admin/:path*"] };
