import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { listLeads, STATUS_LABEL, STATUSES, type LeadStatus } from "@/lib/store";
import { formatDay, formatWhen } from "@/lib/time";
import { formatDollars, REQUEST_LABEL, URGENCY_LABEL } from "@/lib/validate";
import { InfluenceChip, StatusPill } from "../ui";

const FILTERS: [string, string][] = [["open", "Open"], ["all", "All"], ...STATUSES.map((s) => [s, STATUS_LABEL[s]] as [string, string])];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const raw = (await searchParams).status ?? "open";
  const status = FILTERS.some(([k]) => k === raw) ? (raw as LeadStatus | "open" | "all") : "open";
  const leads = await listLeads(await getDb(), { status });

  return (
    <>
      <div className="page-head">
        <h1>Leads</h1>
        <div className="head-actions">
          <Link href="/admin/leads/new" className="abtn abtn-primary">Add a lead</Link>
          <a href="/admin/export/leads.csv" className="abtn">Export CSV</a>
        </div>
      </div>
      <div className="tabs" role="group" aria-label="Filter by status">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={`/admin/leads?status=${k}`} aria-current={k === status ? "true" : undefined}>{label}</Link>
        ))}
      </div>

      {leads.length === 0 ? (
        <p className="empty">No leads here{status === "open" ? " — nothing is waiting on a call" : ""}.</p>
      ) : (
        <ul className="cards">
          {leads.map((l) => (
            <li key={l.id}>
              <Link href={`/admin/leads/${l.id}`} className="card">
                <div className="card-top">
                  <span className="card-name">{l.name}</span>
                  <StatusPill status={l.status} />
                </div>
                <p className="card-line">
                  {REQUEST_LABEL[l.request_type]}
                  {l.urgency && <> · <span className={l.urgency === "urgent" ? "urgent" : ""}>{URGENCY_LABEL[l.urgency]}</span></>}
                  {l.town && <> · {l.town}</>}
                </p>
                <p className="card-meta">
                  <span>{formatWhen(l.created_at)}</span>
                  <InfluenceChip influence={l.influence} />
                  {l.utm_campaign && <span className="mono">{l.utm_campaign}</span>}
                  {l.origin === "manual" && <span>added by hand</span>}
                </p>
                {(l.next_followup || l.job_count > 0) && (
                  <p className="card-meta">
                    {l.next_followup && <span>Follow up {formatDay(l.next_followup)}</span>}
                    {l.job_count > 0 && <span>{l.job_count} job{l.job_count === 1 ? "" : "s"}{l.revenue_cents > 0 ? ` · ${formatDollars(l.revenue_cents)} reported` : ""}</span>}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
