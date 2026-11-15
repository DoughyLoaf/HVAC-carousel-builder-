import type { Metadata, Viewport } from "next";
import { brand, copy } from "@content/site";
import { siteMode } from "@/lib/launch";
import "@fontsource-variable/assistant/wght.css";
import "./globals.css";

export function generateMetadata(): Metadata {
  const live = siteMode() === "live";
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    // Until every launch blocker is cleared, search engines are told to stay away.
    robots: live ? { index: true, follow: true } : { index: false, follow: false },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: brand.colors.brand,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const c = brand.colors;
  const vars = {
    "--ink": c.ink, "--paper": c.paper, "--brand": c.brand, "--brand-deep": c.brandDeep,
    "--accent": c.accent, "--accent-ink": c.accentInk,
  } as React.CSSProperties;
  return (
    <html lang="en">
      <body style={vars}>{children}</body>
    </html>
  );
}
