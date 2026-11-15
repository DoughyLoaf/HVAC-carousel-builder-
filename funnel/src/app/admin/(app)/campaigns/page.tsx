import { requireAdmin } from "@/lib/admin";
import { INFLUENCE_LABEL, trackedUrl } from "@/lib/attribution";
import { getDb } from "@/lib/db";
import { siteUrl } from "@/lib/site-url";
import { callClicksBy, listCampaigns, outcomeBy } from "@/lib/store";
import { formatDay } from "@/lib/time";
import { formatDollars } from "@/lib/validate";
import { editCampaign, saveCampaign } from "../actions";
import { ErrorBanner, Legend } from "../ui";

const KINDS = ["content", "ad", "referral", "review", "campaign"] as const;

export default async function Campaigns({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const db = await getDb();
  const [campaigns, outcomes, taps, base] = await Promise.all([
    listCampaigns(db), outcomeBy(db, "campaign", null), callClicksBy(db, "campaign", null), siteUrl(),
  ]);
  const bySlug = new Map(outcomes.map((o) => [o.key, o]));

  return (
    <>
      <div className="page-head"><h1>Campaigns</h1></div>
      <p className="muted">
        One entry per ad, reel, carousel, review ask, referral push or mailer. Each gets a tracked link; every lead and
        call tap that arrives through it is counted against it.
      </p>
      <ErrorBanner error={(await searchParams).error} />

      <details className="panel job" open={campaigns.length === 0}>
        <summary><span className="row-title">New campaign</span></summary>
        <form action={saveCampaign} className="form-grid">
          <label className="afield"><span>Name</span><input name="name" required maxLength={120} placeholder="Carousel 4 — No heat?" /></label>
          <label className="afield"><span>Link name (optional)</span><input name="slug" maxLength={60} placeholder="made from the name" /></label>
          <label className="afield"><span>Kind</span>
            <select name="influence" defaultValue="content">{KINDS.map((k) => <option key={k} value={k}>{INFLUENCE_LABEL[k]}</option>)}</select>
          </label>
          <label className="afield"><span>Preselect on the form</span>
            <select name="intent" defaultValue="">
              <option value="">Nothing</option>
              <option value="heating_service">Heating service</option>
              <option value="replacement_estimate">Replacement estimate</option>
            </select>
          </label>
          <label className="afield"><span>Source (where the link lives)</span><input name="utm_source" maxLength={60} placeholder="instagram, google, gbp, mailer" /></label>
          <label className="afield"><span>Medium</span><input name="utm_medium" maxLength={60} placeholder="carousel, reel, cpc, review, qr, email" /></label>
          <label className="afield"><span>Content piece</span><input name="content_ref" maxLength={120} placeholder="Carousel 4, Reel 2" /></label>
          <label className="afield"><span>Content tag (utm_content)</span><input name="utm_content" maxLength={60} placeholder="slide-7, bio-link" /></label>
          <label className="afield"><span>Ad name or ID</span><input name="ad_ref" maxLength={120} /></label>
          <label className="afield"><span>Starts</span><input type="date" name="starts_on" /></label>
          <label className="afield"><span>Ends</span><input type="date" name="ends_on" /></label>
          <label className="afield"><span>Reported spend ($)</span><input name="spend" inputMode="decimal" /></label>
          <label className="afield"><span>Spend reported by</span><input name="spend_reported_by" maxLength={80} /></label>
          <label className="afield wide"><span>Notes</span><textarea name="notes" rows={2} maxLength={1000} /></label>
          <div className="wide"><button className="abtn abtn-primary">Create campaign</button></div>
        </form>
      </details>

      {campaigns.length === 0 && <p className="empty">No campaigns yet. Untagged leads still show up under Attribution as direct, search or referral traffic.</p>}

      <ul className="cards">
        {campaigns.map((c) => {
          const o = bySlug.get(c.slug);
          const url = trackedUrl(base, c);
          return (
            <li key={c.id} className={c.active ? "card static" : "card static dim"}>
              <div className="card-top">
                <span className="card-name">{c.name}</span>
                <span className="chip-inf">{INFLUENCE_LABEL[c.influence]}</span>
              </div>
              <p className="card-meta">
                {c.content_ref && <span>{c.content_ref}</span>}
                {c.ad_ref && <span>ad {c.ad_ref}</span>}
                {(c.starts_on || c.ends_on) && <span>{formatDay(c.starts_on)} → {c.ends_on ? formatDay(c.ends_on) : "open"}</span>}
                {!c.active && <span>paused</span>}
              </p>
              <dl className="mini-stats">
                <div><dt>Leads</dt><dd>{o?.leads ?? 0}</dd></div>
                <div><dt>Booked</dt><dd>{o?.booked ?? 0}</dd></div>
                <div><dt>Won</dt><dd>{o?.won ?? 0}</dd></div>
                <div><dt>Reported revenue</dt><dd>{o && o.revenue_cents > 0 ? formatDollars(o.revenue_cents) : "—"}</dd></div>
                <div><dt>Call taps</dt><dd>{taps[c.slug] ?? 0}</dd></div>
                <div><dt>Reported spend</dt><dd>{formatDollars(c.reported_spend_cents)}{c.spend_reported_by && <span className="sub">by {c.spend_reported_by}</span>}</dd></div>
              </dl>
              <label className="afield"><span>Short link — for a bio, QR code or print</span><input readOnly value={`${base}/go/${c.slug}`} className="mono" /></label>
              <label className="afield"><span>Full tagged link — for an ad’s destination URL</span><input readOnly value={url} className="mono" /></label>
              <details className="job">
                <summary><span className="row-title">Edit spend, notes, pause</span></summary>
                <form action={editCampaign} className="form-grid">
                  <input type="hidden" name="campaign_id" value={c.id} />
                  <label className="afield"><span>Reported spend ($)</span><input name="spend" inputMode="decimal" defaultValue={c.reported_spend_cents != null ? (c.reported_spend_cents / 100).toString() : ""} /></label>
                  <label className="afield"><span>Spend reported by</span><input name="spend_reported_by" defaultValue={c.spend_reported_by} maxLength={80} /></label>
                  <label className="afield wide"><span>Notes</span><textarea name="notes" rows={2} defaultValue={c.notes} maxLength={1000} /></label>
                  <label className="acheck wide"><input type="checkbox" name="active" defaultChecked={c.active} /> Active (the short link works either way; this only sorts the list)</label>
                  <div className="wide"><button className="abtn">Save</button></div>
                </form>
              </details>
            </li>
          );
        })}
      </ul>
      <Legend />
    </>
  );
}
