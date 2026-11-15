import { isAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { attributionRows } from "@/lib/store";

/** Spreadsheet-safe cell: quoted, and never starting with a character a spreadsheet would run as a formula. */
function cell(value: unknown): string {
  let s = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  if (!(await isAdmin())) return new Response("Sign in first.", { status: 401 });
  const rows = await attributionRows(await getDb(), null, false);
  const header = [
    "lead_id", "created_at", "name", "status", "booked_at", "request_type", "influence", "influence_basis", "campaign_tag",
    "campaign_name", "content_piece", "ad", "utm_source", "utm_medium", "utm_content", "landing_page", "referrer",
    "referral_code", "self_reported_source", "jobs", "reported_revenue_usd",
  ];
  const lines = rows.map((r) => [
    r.id, r.created_at, r.name, r.status, r.booked_at, r.request_type, r.influence, r.influence_basis, r.utm_campaign,
    r.campaign_name, r.content_ref, r.ad_ref, r.utm_source, r.utm_medium, r.utm_content, r.landing_path, r.referrer,
    r.ref_code, r.self_reported_source, r.job_count, (r.revenue_cents / 100).toFixed(2),
  ].map(cell).join(","));
  return new Response([header.map(cell).join(","), ...lines].join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cda-leads.csv"',
      "Cache-Control": "no-store",
    },
  });
}
