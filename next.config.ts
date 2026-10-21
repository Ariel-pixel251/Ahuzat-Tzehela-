import type { NextConfig } from "next";

// Security headers for every response. The Content Security Policy (with a per-request nonce)
// is set in proxy.ts.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // edit links carry a private token in the URL: never leak it to other sites
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  // PGlite (local database) ships WebAssembly; load it from node_modules at runtime
  serverExternalPackages: ["@electric-sql/pglite"],
  // the privacy notices are read from legal/*.md at request time
  outputFileTracingIncludes: { "/**": ["./legal/**/*.md"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
