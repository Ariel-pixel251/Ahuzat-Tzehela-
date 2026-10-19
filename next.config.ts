import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (local database) ships WebAssembly; load it from node_modules at runtime
  devIndicators: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // edit links carry a private token in the URL: never leak it to other sites
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
