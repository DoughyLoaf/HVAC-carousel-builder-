import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { INFLUENCE_LABEL, type Influence } from "@/lib/attribution";
import { getDb } from "@/lib/db";
import { attributionRows, callClicksBy, listCampaigns, outcomeBy } from "@/lib/store";
import { formatWhen, parseRange } from "@/lib/time";
import { formatDollars, REQUEST_LABEL } from "@/lib/validate";
import { InfluenceChip, Legend, OutcomeTable, RangeTabs, StatusPill } from "../ui";

function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

export default async function Attribution({ searchParams }: { searchParams: Promise<{ range?: string; show?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const { key, since } = parseRange(sp.range);
  const bookedOnly = sp.show === "booked";
  const db = await getDb();
  const [byInfluence, byCampaign, byContent, byLanding, bySelf, taps, campaigns, rows] = await Promise.all([
    outcomeBy(db, "influence", since), outcomeBy(db, "campaign", since), outcomeBy(db, "content", since),
    outcomeBy(db, "landing", since), outcomeBy(db, "self_reported", since), callClicksBy(db, "campaign", since),
    listCampaigns(db), attributionRows(db, since, bookedOnly),
  ]);
  const campaignBySlug = new Map(campaigns.map((c) => [c.slug, c]));

  return (
    <>
      <div className="page-head">
        <h1>Attribution</h1>
        <RangeTabs base="/admin/attribution" current={key} extra={bookedOnly ? "&show=booked" : ""} />
      </div>
      <p className="muted">Which landing page, content, ad, referral, review or campaign sat behind each lead and each booked job.</p>

      <section className="panel">
        <h2>By kind of influence</h2>
        <OutcomeTable rows={byInfluence.map((r) => ({ ...r, label: INFLUENCE_LABEL[r.key as Influence] ?? r.key }))} first="Influence" empty="No leads in this period." />
      </section>

      <section className="panel">
        <h2>By campaign</h2>
        <OutcomeTable
          rows={byCampaign.filter((r) => r.key !== "").map((r) => {
            const c = campaignBySlug.get(r.key);
            return {
              ...r,
              label: c?.name ?? r.key,
              sub: c ? [c.content_ref, c.ad_ref && `ad ${c.ad_ref}`].filter(Boolean).join(" · ") || r.key : "tag not registered under Campaigns",
              callTaps: taps[r.key] ?? 0,
              spendCents: c?.reported_spend_cents ?? null,
            };
          })}
          first="Campaign" showTaps showSpend empty="No lead in this period carried a campaign tag."
        />
        <p className="more"><Link href="/admin/campaigns">Set up campaigns and tracked links →</Link></p>
      </section>

      <section className="panel">
        <h2>By content or ad tag</h2>
        <OutcomeTable rows={byContent.filter((r) => r.key !== "").map((r) => ({ ...r, label: r.key }))} first="utm_content" empty="No lead in this period carried a content tag." />
      </section>

      <section className="panel">
        <h2>By landing page</h2>
        <OutcomeTable rows={byLanding.map((r) => ({ ...r, label: r.key || "Not recorded (added by hand)" }))} first="Landing page" empty="No leads in this period." />
      </section>

      <section className="panel">
        <h2>What people said when asked</h2>
        <p className="muted small">“How did you hear about CDA?” — self-reported, optional, shown beside the tracked answer and never merged into it.</p>
        <OutcomeTable rows={bySelf.map((r) => ({ ...r, label: r.key || "Not answered" }))} first="They said" empty="No leads in this period." />
      </section>

      <section className="panel">
        <div className="page-head">
          <h2>{bookedOnly ? "Booked jobs" : "Every lead"}, one by one</h2>
          <div className="tabs">
            <Link href={`/admin/attribution?range=${key}`} aria-current={!bookedOnly ? "true" : undefined}>All leads</Link>
            <Link href={`/admin/attribution?range=${key}&show=booked`} aria-current={bookedOnly ? "true" : undefined}>Booked only</Link>
          </div>
        </div>
        {rows.length === 0 ? <p className="empty">Nothing to show for this period.</p> : (
          <div className="table-scroll">
            <table className="atable">
              <thead>
                <tr><th>Lead</th><th>Status</th><th>Influence</th><th>Campaign · content · ad</th><th>Source / medium</th><th>Landing page</th><th>Referrer</th><th>They said</th><th className="num">Reported revenue</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <th scope="row"><Link href={`/admin/leads/${r.id}`}>{r.name}</Link><span className="sub">{formatWhen(r.created_at)} · {REQUEST_LABEL[r.request_type]}</span></th>
                    <td><StatusPill status={r.status} />{r.booked_at && <span className="sub">booked {formatWhen(r.booked_at)}</span>}</td>
                    <td><InfluenceChip influence={r.influence} /><span className="sub">{r.influence_basis}</span></td>
                    <td>{r.campaign_name ?? (r.utm_campaign ? <span className="mono">{r.utm_campaign}</span> : "—")}
                      <span className="sub">{[r.content_ref, r.utm_content && `content: ${r.utm_content}`, r.ad_ref && `ad: ${r.ad_ref}`, r.ref_code && `ref: ${r.ref_code}`].filter(Boolean).join(" · ")}</span></td>
                    <td className="mono">{[r.utm_source, r.utm_medium].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="mono">{r.landing_path || "—"}</td>
                    <td className="mono">{host(r.referrer) || "—"}</td>
                    <td>{r.self_reported_source || "—"}</td>
                    <td className="num">{r.revenue_cents > 0 ? formatDollars(r.revenue_cents) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Legend />
    </>
  );
}
