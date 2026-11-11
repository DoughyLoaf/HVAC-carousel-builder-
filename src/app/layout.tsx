import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "CDA HVAC Carousel Builder",
  description: "Local production tool. Builds and exports carousels — it never posts, schedules or sends.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand">CDA HVAC Carousel Builder</Link>
            <nav className="topnav" aria-label="Main">
              <Link href="/">Carousels</Link>
              <Link href="/new">New carousel</Link>
              <Link href="/settings">Template settings</Link>
            </nav>
            <span className="export-only">Export only — nothing is posted, scheduled or sent</span>
          </div>
        </header>
        <main>{children}</main>
        <footer className="foot">
          Local tool. Photos, settings and exports stay on this machine. Copy comes only from the
          build-ready Markdown files or from what you type — the app never writes or suggests copy.
        </footer>
      </body>
    </html>
  );
}
