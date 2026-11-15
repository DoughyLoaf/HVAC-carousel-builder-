import { ledger, photos, reviews, type LedgerClass, type LedgerItem } from "@content/site";
import { requireAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { launchBlockers, photoUsable, siteMode } from "@/lib/launch";
import { describeChannels, notifyConfigFromEnv } from "@/lib/notify";

const SECTIONS: { cls: LedgerClass; title: string; blurb: string }[] = [
  { cls: "verified", title: "Verified facts", blurb: "Confirmed by a named person on a date. These can appear on the public page." },
  { cls: "reported", title: "Reported, not yet verified", blurb: "Seen in a listing, a search result or a file — nobody at CDA has confirmed them. Hidden from the live page." },
  { cls: "ai_summary", title: "AI-generated summaries", blurb: "Written by an AI assistant. Useful as a starting point; not evidence." },
  { cls: "assumption", title: "Assumptions", blurb: "Decisions made to get the build moving. Each is a guess until someone signs it off." },
  { cls: "opportunity", title: "Future opportunities", blurb: "Not built, or built and switched off. Nothing here is promised on the page." },
];

function Item({ i }: { i: LedgerItem }) {
  return (
    <li className="ledger-item">
      <p className="row-title">
        {i.label}
        {i.requiredForLaunch && i.class !== "verified" && <span className="pill pill-lost">blocks launch</span>}
        <span className="pill">{i.audience === "public" ? "public" : "internal"}</span>
      </p>
      <p>{i.value}</p>
      <p className="muted small">
        <strong>Source:</strong> {i.source} <strong>Checked:</strong> {i.checkedOn}
        {i.class === "verified" && <> · <strong>Verified by</strong> {i.verifiedBy} on {i.verifiedOn}</>}
      </p>
      {i.toVerify && i.class !== "verified" && <p className="small"><strong>To settle it:</strong> {i.toVerify}</p>}
    </li>
  );
}

function Check({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="check">
      <span className={ok ? "check-mark ok" : "check-mark no"} aria-hidden="true">{ok ? "✓" : "!"}</span>
      <div><p className="row-title">{label}</p><p className="muted small">{detail}</p></div>
    </li>
  );
}

export default async function Launch() {
  await requireAdmin();
  const blockers = launchBlockers();
  const mode = siteMode(process.env, blockers);
  const wantsLive = process.env.SITE_MODE === "live";
  const channels = describeChannels(notifyConfigFromEnv());
  const db = await getDb();

  return (
    <>
      <div className="page-head"><h1>Launch checklist</h1></div>

      <section className="panel">
        <h2>Status: {mode === "live" ? "Live" : "Preview"}</h2>
        {mode === "live" ? (
          <p>The page is public and search engines may index it.</p>
        ) : blockers.length > 0 ? (
          <p>
            The page shows a preview ribbon and tells search engines to stay away.
            {wantsLive ? " SITE_MODE is set to live, but the site will not go live until the list below is empty." : ""}
          </p>
        ) : (
          <p>Nothing is blocking launch. Set <code>SITE_MODE=live</code> on the server and redeploy.</p>
        )}
        {blockers.length > 0 && (
          <ul className="rows">
            {blockers.map((b) => (
              <li key={b.id} className="row-item"><div className="row-main"><p className="row-title tone-stop">{b.label}</p><p className="small">{b.why}</p></div></li>
            ))}
          </ul>
        )}
        <p className="muted small">To clear an item, edit <code>content/site.ts</code>: set its class to “verified” and fill in who verified it and when. Then redeploy.</p>
      </section>

      <section className="panel">
        <h2>Setup</h2>
        <ul className="checks">
          <Check ok={db.kind === "postgres"} label="Lead database"
            detail={db.kind === "postgres" ? "Connected to Postgres through DATABASE_URL." : "Using the built-in development database on this machine. Set DATABASE_URL before real leads arrive."} />
          <Check ok={channels.email} label="Email alert for new leads"
            detail={channels.email ? "On. Each new request is emailed to LEAD_NOTIFY_EMAIL_TO." : "Off. Needs RESEND_API_KEY, LEAD_NOTIFY_EMAIL_TO and LEAD_NOTIFY_EMAIL_FROM."} />
          <Check ok={channels.webhook} label="Webhook alert (Slack, Zapier, an SMS relay)"
            detail={channels.webhook ? "On. Each new request is posted to LEAD_NOTIFY_WEBHOOK_URL." : "Off. Optional — set LEAD_NOTIFY_WEBHOOK_URL to use it."} />
          <Check ok={Boolean(process.env.SITE_URL)} label="Public address"
            detail={process.env.SITE_URL ? `SITE_URL is ${process.env.SITE_URL}.` : "SITE_URL is not set, so alert emails carry no link back to the lead and tracked links use whatever address you are browsing on."} />
        </ul>
      </section>

      {SECTIONS.map((s) => {
        const items = ledger.filter((i) => i.class === s.cls);
        return (
          <section className="panel" key={s.cls}>
            <h2>{s.title} · {items.length}</h2>
            <p className="muted">{s.blurb}</p>
            {items.length === 0 ? <p className="empty">Nothing in this group.</p> : <ul className="ledger">{items.map((i) => <Item key={i.id} i={i} />)}</ul>}
          </section>
        );
      })}

      <section className="panel">
        <h2>Reported numbers inside this workspace</h2>
        <p>
          Revenue on jobs and spend on campaigns are typed in by a person and stored with that person’s name and the
          date. Every screen labels them “reported”. Lead, booked and won counts come from this workspace’s own
          records. Call taps are taps on a button, not confirmed calls.
        </p>
      </section>

      <section className="panel">
        <h2>Photo slots</h2>
        <p className="muted">Real CDA photos only. A slot shows on the page when its file is in <code>public/photos/</code>, it has alt text, and — for anything shot inside a home — homeowner permission is recorded as “Y”.</p>
        <div className="table-scroll">
          <table className="atable">
            <thead><tr><th>Slot</th><th>Wanted</th><th>File</th><th>Inside a home</th><th>Permission</th><th>On the page</th></tr></thead>
            <tbody>
              {photos.map((p) => (
                <tr key={p.id}>
                  <th scope="row">{p.id}</th><td>{p.wanted}</td><td className="mono">{p.file || "—"}</td>
                  <td>{p.insideHome ? "yes" : "no"}</td><td>{p.permission || "not recorded"}</td><td>{photoUsable(p) ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Reviews on the page: {reviews.length}. The block stays hidden until real, permitted reviews are added in <code>content/site.ts</code>.</p>
      </section>
    </>
  );
}
