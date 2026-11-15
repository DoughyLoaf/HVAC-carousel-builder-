import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { logout } from "../login/actions";
import "../admin.css";

export const metadata: Metadata = { title: "CDA lead workspace", robots: { index: false, follow: false } };

const NAV = [
  ["/admin", "Overview"],
  ["/admin/leads", "Leads"],
  ["/admin/follow-ups", "Follow-ups"],
  ["/admin/jobs", "Jobs"],
  ["/admin/attribution", "Attribution"],
  ["/admin/campaigns", "Campaigns"],
  ["/admin/launch", "Launch"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="admin">
      <header className="abar">
        <div className="abar-top">
          <Link href="/admin" className="abar-brand">CDA lead workspace</Link>
          <div className="abar-right">
            <Link href="/" className="abar-link">View site</Link>
            <form action={logout}><button className="abar-link">Sign out</button></form>
          </div>
        </div>
        <nav className="anav" aria-label="Workspace">
          {NAV.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
      </header>
      <main className="amain">{children}</main>
    </div>
  );
}
