import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The embedded dev database (PGlite) and the Postgres driver load native/WASM
  // files at runtime, so they stay outside the server bundle.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "sharp"],
  // This app lives in a subfolder of the carousel-builder repository; keep
  // file tracing inside this folder.
  outputFileTracingRoot: path.resolve(import.meta.dirname),
  turbopack: { root: path.resolve(import.meta.dirname) },
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
