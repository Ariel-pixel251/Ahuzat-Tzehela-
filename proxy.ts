import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { adminSessionFresh, isAdminEmail } from "@/lib/auth/admin-rules";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase-config";

// Runs before every page:
// * a Content Security Policy with a fresh nonce: only this site's own scripts (and the ones
//   Next.js marks with the nonce) can run, the site can't be framed, forms post only here;
// * the admin area: refreshes the Supabase session and turns away anyone who isn't a signed-in
//   admin (pages, actions and the CSV export check again on the server).

const ADMIN_PUBLIC = ["/admin/login", "/admin/auth/callback", "/admin/setup"];

function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    // 'strict-dynamic': scripts loaded by a trusted (nonce) script are trusted too; dev tools need eval
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // React and Next.js set some inline style attributes; styles can't run code
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function withCsp(request: NextRequest, nonce: string, csp: string) {
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Supabase falls back to the Site URL ("/") when /admin/auth/callback isn't in its Redirect URLs
  // list; forward a sign-in code (a UUID) or a sign-in error to the admin pages (fixed paths only).
  if (pathname === "/") {
    const code = searchParams.get("code");
    if (code && /^[0-9a-f-]{36}$/i.test(code)) {
      return NextResponse.redirect(new URL(`/admin/auth/callback?code=${code}`, request.url));
    }
    if (searchParams.get("error_code")) return NextResponse.redirect(new URL("/admin/login?error=1", request.url));
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  let response = withCsp(request, nonce, csp);
  if (!pathname.startsWith("/admin")) return response;

  // admin pages are never cached and never indexed
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex");
  const isPublic = ADMIN_PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  let admin = false;
  const url = supabaseUrl();
  const key = supabasePublicKey();
  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = withCsp(request, nonce, csp);
          response.headers.set("Cache-Control", "no-store");
          response.headers.set("X-Robots-Tag", "noindex");
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    admin = Boolean(data.user && isAdminEmail(data.user.email) && adminSessionFresh(data.user.last_sign_in_at));
  } else if (process.env.NODE_ENV !== "production") {
    // local development without Supabase: the "dev sign-in" cookie
    admin = request.cookies.get("dev_admin")?.value === "1";
  }

  if (admin || isPublic) return response;
  if (pathname.startsWith("/admin/export")) {
    return new NextResponse("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: [
    // every page, but not the static files
    { source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf)$).*)" },
  ],
};
