import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { classifyTouch, INFLUENCE_LABEL, INFLUENCES, type Touch } from "@/lib/attribution";
import { getDb } from "@/lib/db";
import { getLead, JOB_STATUSES, JOB_TYPES, listCampaigns, STATUS_LABEL, STATUSES, type Job } from "@/lib/store";
import { formatDay, formatWhen, todayInBusinessTz } from "@/lib/time";
import { formatDollars, REQUEST_LABEL, URGENCY_LABEL } from "@/lib/validate";
import { changeStatus, finishFollowup, overrideInfluence, saveFollowup, saveJob, saveNote } from "../../actions";
import { ErrorBanner, InfluenceChip, StatusPill } from "../../ui";

const TOUCH_FIELDS: [keyof Touch, string][] = [
  ["landing_path", "Landing page"], ["referrer", "Came from (referrer)"], ["utm_source", "Source"], ["utm_medium", "Medium"],
  ["utm_campaign", "Campaign"], ["utm_content", "Content / ad"], ["utm_term", "Search term"], ["ref_code", "Referral code"],
  ["gclid", "Google Ads click ID"], ["fbclid", "Meta click ID"], ["msclkid", "Microsoft Ads click ID"],
];

function TouchTable({ title, touch, note }: { title: string; touch: Touch; note: string }) {
  const rows = TOUCH_FIELDS.filter(([k]) => touch[k]);
  return (
    <div className="touch">
      <h3>{title}</h3>
      <p className="muted small">{note}</p>
      {rows.length === 0 ? <p className="small">Nothing recorded.</p> : (
        <dl className="kv">
          {rows.map(([k, label]) => (<div key={k}><dt>{label}</dt><dd className="mono">{touch[k]}</dd></div>))}
        </dl>
      )}
    </div>
  );
}

function JobForm({ leadId, job }: { leadId: string; job?: Job }) {
  return (
    <form action={saveJob} className="form-grid">
      <input type="hidden" name="lead_id" value={leadId} />
      {job && <input type="hidden" name="job_id" value={job.id} />}
      <label className="afield"><span>Type</span>
        <select name="job_type" defaultValue={job?.job_type ?? "repair"}>{JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
      </label>
      <label className="afield"><span>Status</span>
        <select name="status" defaultValue={job?.status ?? "booked"}>{JOB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </label>
      <label className="afield wide"><span>What it is</span><input name="description" defaultValue={job?.description ?? ""} maxLength={300} /></label>
      <label className="afield"><span>Scheduled for</span><input type="date" name="scheduled_on" defaultValue={job?.scheduled_on ?? ""} /></label>
      <label className="afield"><span>Completed on</span><input type="date" name="completed_on" defaultValue={job?.completed_on ?? ""} /></label>
      <label className="afield"><span>Reported revenue ($)</span>
        <input name="revenue" inputMode="decimal" defaultValue={job?.reported_revenue_cents != null ? (job.reported_revenue_cents / 100).toString() : ""} />
      </label>
      <label className="afield"><span>Reported by</span><input name="revenue_reported_by" defaultValue={job?.revenue_reported_by ?? ""} maxLength={80} /></label>
      <div className="wide"><button className="abtn abtn-primary">{job ? "Save job" : "Add job"}</button></div>
    </form>
  );
}

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const db = await getDb();
  const [detail, campaigns] = await Promise.all([getLead(db, id), listCampaigns(db)]);
  if (!detail) notFound();
  const { lead: l, jobs, followups, events, notifications, campaign } = detail;
  const digits = l.phone.replace(/\D/g, "");
  const today = todayInBusinessTz();
  const alerted = notifications.some((n) => n.status === "sent");

  return (
    <>
      <p className="crumb"><Link href="/admin/leads">← Leads</Link></p>
      <div className="page-head">
        <div>
          <h1>{l.name}</h1>
          <p className="muted">
            {REQUEST_LABEL[l.request_type]}
            {l.urgency && <> · <span className={l.urgency === "urgent" ? "urgent" : ""}>{URGENCY_LABEL[l.urgency]}</span></>}
            {" · "}{formatWhen(l.created_at)}{l.origin === "manual" && " · added by hand"}
          </p>
        </div>
        <StatusPill status={l.status} />
      </div>
      <ErrorBanner error={(await searchParams).error} />

      <section className="panel">
        <div className="contact-actions">
          {digits && <a className="abtn abtn-primary" href={`tel:${digits}`}>Call {l.phone}</a>}
          {digits && <a className="abtn" href={`sms:${digits}`}>Text</a>}
          {l.email && <a className="abtn" href={`mailto:${l.email}`}>Email</a>}
        </div>
        <dl className="kv">
          <div><dt>Prefers</dt><dd>{l.preferred_contact === "either" ? "Call or text" : l.preferred_contact}</dd></div>
          {(l.town || l.zip) && <div><dt>Where</dt><dd>{[l.town, l.zip].filter(Boolean).join(" ")}</dd></div>}
          {l.email && <div><dt>Email</dt><dd>{l.email}</dd></div>}
          {l.message && <div><dt>They wrote</dt><dd className="pre">{l.message}</dd></div>}
        </dl>
      </section>

      <section className="panel">
        <h2>Status</h2>
        <form action={changeStatus} className="form-grid">
          <input type="hidden" name="lead_id" value={l.id} />
          <label className="afield"><span>Move to</span>
            <select name="status" defaultValue={l.status}>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
          </label>
          <label className="afield"><span>Why (optional)</span><input name="note" maxLength={1000} /></label>
          <div className="wide"><button className="abtn abtn-primary">Save status</button></div>
        </form>
        <dl className="kv milestones">
          <div><dt>First contacted</dt><dd>{formatWhen(l.contacted_at)}</dd></div>
          <div><dt>Booked</dt><dd>{formatWhen(l.booked_at)}</dd></div>
          <div><dt>Closed</dt><dd>{formatWhen(l.closed_at)}</dd></div>
        </dl>
      </section>

      <section className="panel">
        <h2>Follow-ups</h2>
        {followups.length > 0 && (
          <ul className="rows">
            {followups.map((f) => (
              <li key={f.id} className={f.done_at ? "row-item dim" : "row-item"}>
                <div className="row-main">
                  <p className={!f.done_at && f.due_on < today ? "row-title tone-stop" : "row-title"}>
                    {formatDay(f.due_on)}{!f.done_at && f.due_on < today && " · overdue"}{f.done_at && " · done"}
                  </p>
                  {f.note && <p>{f.note}</p>}
                </div>
                {!f.done_at && (
                  <form action={finishFollowup} className="row-actions">
                    <input type="hidden" name="lead_id" value={l.id} />
                    <input type="hidden" name="followup_id" value={f.id} />
                    <button className="abtn">Done</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        <form action={saveFollowup} className="form-grid">
          <input type="hidden" name="lead_id" value={l.id} />
          <label className="afield"><span>Follow up on</span><input type="date" name="due_on" required min={today} /></label>
          <label className="afield"><span>About</span><input name="note" maxLength={500} /></label>
          <div className="wide"><button className="abtn">Set follow-up</button></div>
        </form>
      </section>

      <section className="panel">
        <h2>Jobs</h2>
        {jobs.length === 0 && <p className="muted">No job yet. Adding one marks this lead as booked.</p>}
        {jobs.map((j) => (
          <details key={j.id} className="job">
            <summary>
              <span className="row-title">{j.job_type}{j.description && ` — ${j.description}`}</span>
              <span className="card-meta">
                <span>{j.status}</span>
                {j.scheduled_on && <span>{formatDay(j.scheduled_on)}</span>}
                <span>{j.reported_revenue_cents != null ? `${formatDollars(j.reported_revenue_cents)} reported by ${j.revenue_reported_by}` : "no revenue reported"}</span>
              </span>
            </summary>
            <JobForm leadId={l.id} job={j} />
          </details>
        ))}
        <details className="job" open={jobs.length === 0}>
          <summary><span className="row-title">Add a job</span></summary>
          <JobForm leadId={l.id} />
        </details>
      </section>

      <section className="panel">
        <h2>What influenced this lead</h2>
        <p className="influence-line"><InfluenceChip influence={l.influence} /> <span>{l.influence_basis}</span></p>
        <dl className="kv">
          <div><dt>Campaign</dt><dd>{campaign ? <>{campaign.name}{campaign.content_ref && ` · ${campaign.content_ref}`}{campaign.ad_ref && ` · ad ${campaign.ad_ref}`}</> : l.utm_campaign ? <><span className="mono">{l.utm_campaign}</span> (tag not registered under Campaigns)</> : "None"}</dd></div>
          <div><dt>They said</dt><dd>{l.self_reported_source || "Not asked or not answered"}</dd></div>
        </dl>
        <div className="touches">
          {l.last_touch && (
            <TouchTable title="Converting visit" touch={l.last_touch}
              note={`The visit that sent the form · reads as: ${INFLUENCE_LABEL[classifyTouch(l.last_touch).influence]}`} />
          )}
          {l.first_touch && (
            <TouchTable title="First visit seen" touch={l.first_touch}
              note={`${l.first_touch.at ? formatWhen(new Date(l.first_touch.at)) : ""} · reads as: ${INFLUENCE_LABEL[classifyTouch(l.first_touch).influence]}`} />
          )}
        </div>
        <details className="job">
          <summary><span className="row-title">Correct this by hand</span></summary>
          <form action={overrideInfluence} className="form-grid">
            <input type="hidden" name="lead_id" value={l.id} />
            <label className="afield"><span>Influence</span>
              <select name="influence" defaultValue={l.influence}>{INFLUENCES.map((i) => <option key={i} value={i}>{INFLUENCE_LABEL[i]}</option>)}</select>
            </label>
            <label className="afield"><span>Campaign</span>
              <select name="campaign" defaultValue={campaign?.slug ?? ""}>
                <option value="">None</option>
                {campaigns.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </label>
            <label className="afield"><span>Your name</span><input name="who" required maxLength={60} /></label>
            <div className="wide"><button className="abtn">Save correction</button></div>
          </form>
        </details>
      </section>

      <section className="panel">
        <h2>Notes &amp; history</h2>
        <form action={saveNote} className="form-grid">
          <input type="hidden" name="lead_id" value={l.id} />
          <label className="afield wide"><span>Add a note</span><textarea name="body" rows={2} maxLength={4000} required /></label>
          <div className="wide"><button className="abtn">Save note</button></div>
        </form>
        <ul className="timeline">
          {events.map((e) => (
            <li key={e.id}><span className="tl-when">{formatWhen(e.at)}</span><span className={`tl-kind tl-${e.kind}`}>{e.kind}</span><span className="pre">{e.body}</span></li>
          ))}
        </ul>
      </section>

      {l.origin === "web_form" && (
        <section className="panel">
          <h2>Alerts sent for this lead</h2>
          {!alerted && l.status !== "spam" && <p className="banner banner-stop">No alert was delivered for this lead. Whoever works leads may not know it exists.</p>}
          {notifications.length === 0 ? <p className="muted">No attempt recorded.</p> : (
            <ul className="timeline">
              {notifications.map((n) => (
                <li key={n.id}><span className="tl-when">{formatWhen(n.at)}</span><span className={`tl-kind tl-${n.status}`}>{n.channel} · {n.status.replace("_", " ")}</span><span>{n.detail}</span></li>
              ))}
            </ul>
          )}
          {l.consent_text && <p className="muted small">Consent shown at submit: “{l.consent_text}”</p>}
        </section>
      )}
    </>
  );
}
