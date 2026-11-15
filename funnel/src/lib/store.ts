import type { Db } from "./db";
import { classifyLead, classifyTouch, type Influence, type Touch } from "./attribution";
import type { ContactPref, LeadInput, RequestType, Urgency } from "./validate";

export const STATUSES = ["new", "contacted", "booked", "won", "lost", "unreachable", "out_of_area", "spam"] as const;
export type LeadStatus = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  booked: "Booked",
  won: "Won",
  lost: "Lost",
  unreachable: "No response",
  out_of_area: "Out of area",
  spam: "Spam",
};
const OPEN: LeadStatus[] = ["new", "contacted"];
const BOOKED: LeadStatus[] = ["booked", "won"];
const CLOSED: LeadStatus[] = ["won", "lost", "unreachable", "out_of_area", "spam"];

export const JOB_TYPES = ["replacement", "repair", "maintenance", "other"] as const;
export type JobType = (typeof JOB_TYPES)[number];
export const JOB_STATUSES = ["booked", "completed", "cancelled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface Lead {
  id: string;
  created_at: Date;
  origin: "web_form" | "manual";
  request_type: RequestType;
  urgency: Urgency;
  town: string;
  zip: string;
  message: string;
  name: string;
  phone: string;
  email: string;
  preferred_contact: ContactPref;
  consent_text: string;
  landing_path: string;
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  gclid: string;
  fbclid: string;
  msclkid: string;
  ref_code: string;
  last_touch: Touch | null;
  first_touch: Touch | null;
  self_reported_source: string;
  influence: Influence;
  influence_basis: string;
  status: LeadStatus;
  contacted_at: Date | null;
  booked_at: Date | null;
  closed_at: Date | null;
}

export interface Job {
  id: string;
  created_at: Date;
  lead_id: string;
  job_type: JobType;
  description: string;
  status: JobStatus;
  scheduled_on: string | null;
  completed_on: string | null;
  reported_revenue_cents: number | null;
  revenue_reported_by: string;
  revenue_reported_on: string | null;
}

export interface Followup {
  id: string;
  lead_id: string;
  due_on: string;
  note: string;
  done_at: Date | null;
}

export interface LeadEvent {
  id: string;
  at: Date;
  kind: string;
  body: string;
}

export interface NotificationRow {
  id: string;
  at: Date;
  channel: "email" | "webhook" | "none";
  status: "sent" | "failed" | "not_configured";
  detail: string;
}

export interface Campaign {
  id: string;
  created_at: Date;
  slug: string;
  name: string;
  influence: Influence;
  utm_source: string;
  utm_medium: string;
  utm_content: string;
  content_ref: string;
  ad_ref: string;
  intent: "" | "replacement_estimate" | "heating_service";
  starts_on: string | null;
  ends_on: string | null;
  reported_spend_cents: number | null;
  spend_reported_by: string;
  notes: string;
  active: boolean;
}

const LEAD_COLS = `id, created_at, origin, request_type, urgency, town, zip, message, name, phone, email,
  preferred_contact, consent_text, landing_path, referrer, utm_source, utm_medium, utm_campaign, utm_content,
  utm_term, gclid, fbclid, msclkid, ref_code, last_touch, first_touch, self_reported_source, influence, influence_basis,
  status, contacted_at, booked_at, closed_at`;

const JOB_COLS = `id, created_at, lead_id, job_type, description, status, scheduled_on::text as scheduled_on,
  completed_on::text as completed_on, reported_revenue_cents, revenue_reported_by,
  revenue_reported_on::text as revenue_reported_on`;

const CAMPAIGN_COLS = `id, created_at, slug, name, influence, utm_source, utm_medium, utm_content, content_ref,
  ad_ref, intent, starts_on::text as starts_on, ends_on::text as ends_on, reported_spend_cents,
  spend_reported_by, notes, active`;

async function logEvent(db: Db, leadId: string, kind: string, body: string): Promise<void> {
  await db.query("insert into cda_funnel.lead_events (lead_id, kind, body) values ($1, $2, $3)", [leadId, kind, body]);
}

// ───────────────────────── Leads ─────────────────────────

export interface CreateLeadMeta {
  origin: "web_form" | "manual";
  ipHash?: string;
  userAgent?: string;
  /** Manual leads: the person entering it says what influenced it. */
  influence?: { influence: Influence; basis: string };
}

export async function createLead(db: Db, input: LeadInput, meta: CreateLeadMeta): Promise<Lead> {
  const c = meta.influence ? { ...meta.influence, credited: "last" as const } : classifyLead(input.last_touch, input.first_touch);
  // The visit that decided the influence is the one whose campaign, content and landing page get the credit.
  const t = c.credited === "first" && input.first_touch ? input.first_touch : input.last_touch;
  const rows = await db.query<Lead>(
    `insert into cda_funnel.leads
      (origin, request_type, urgency, town, zip, message, name, phone, email, preferred_contact, consent_text,
       landing_path, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, fbclid, msclkid,
       ref_code, first_touch, self_reported_source, influence, influence_basis, ip_hash, user_agent, last_touch)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23::jsonb,$24,$25,$26,$27,$28,$29::jsonb)
     returning ${LEAD_COLS}`,
    [
      meta.origin, input.request_type, input.urgency, input.town, input.zip, input.message, input.name, input.phone,
      input.email, input.preferred_contact, input.consent_text, t.landing_path, t.referrer, t.utm_source,
      t.utm_medium, t.utm_campaign, t.utm_content, t.utm_term, t.gclid, t.fbclid, t.msclkid, t.ref_code,
      input.first_touch ? JSON.stringify(input.first_touch) : null, input.self_reported_source, c.influence,
      c.basis, meta.ipHash ?? "", (meta.userAgent ?? "").slice(0, 300),
      meta.origin === "web_form" ? JSON.stringify(input.last_touch) : null,
    ],
  );
  const lead = rows[0];
  await logEvent(db, lead.id, "created", meta.origin === "web_form" ? "Request sent from the website form." : "Added by hand in the admin.");
  return lead;
}

export async function countRecentLeadsFromIp(db: Db, ipHash: string, minutes: number): Promise<number> {
  if (!ipHash) return 0;
  const rows = await db.query<{ n: number }>(
    "select count(*)::int as n from cda_funnel.leads where ip_hash = $1 and created_at > now() - make_interval(mins => $2::int)",
    [ipHash, minutes],
  );
  return rows[0].n;
}

export interface LeadListRow extends Lead {
  job_count: number;
  revenue_cents: number;
  next_followup: string | null;
}

export async function listLeads(db: Db, opts: { status?: LeadStatus | "open" | "all"; limit?: number } = {}): Promise<LeadListRow[]> {
  const status = opts.status ?? "all";
  const where =
    status === "all" ? "l.status <> 'spam'" : status === "open" ? "l.status in ('new','contacted')" : "l.status = $2";
  const params: unknown[] = [opts.limit ?? 200];
  if (status !== "all" && status !== "open") params.push(status);
  return db.query<LeadListRow>(
    `select ${LEAD_COLS.split(",").map((c) => `l.${c.trim()}`).join(", ")},
       coalesce(j.n, 0)::int as job_count, coalesce(j.rev, 0)::float8 as revenue_cents, f.next::text as next_followup
     from cda_funnel.leads l
     left join (select lead_id, count(*) as n, sum(reported_revenue_cents) filter (where status <> 'cancelled') as rev
                from cda_funnel.jobs group by lead_id) j on j.lead_id = l.id
     left join (select lead_id, min(due_on) as next from cda_funnel.followups where done_at is null group by lead_id) f
            on f.lead_id = l.id
     where ${where}
     order by l.created_at desc
     limit $1`,
    params,
  );
}

export interface LeadDetail {
  lead: Lead;
  jobs: Job[];
  followups: Followup[];
  events: LeadEvent[];
  notifications: NotificationRow[];
  campaign: Campaign | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string): boolean => UUID.test(v);

export async function getLead(db: Db, id: string): Promise<LeadDetail | null> {
  if (!isUuid(id)) return null;
  const leads = await db.query<Lead>(`select ${LEAD_COLS} from cda_funnel.leads where id = $1`, [id]);
  if (leads.length === 0) return null;
  const lead = leads[0];
  const [jobs, followups, events, notifications, campaign] = await Promise.all([
    db.query<Job>(`select ${JOB_COLS} from cda_funnel.jobs where lead_id = $1 order by created_at`, [id]),
    db.query<Followup>(
      "select id, lead_id, due_on::text as due_on, note, done_at from cda_funnel.followups where lead_id = $1 order by done_at nulls first, due_on",
      [id],
    ),
    db.query<LeadEvent>("select id, at, kind, body from cda_funnel.lead_events where lead_id = $1 order by at desc, id", [id]),
    db.query<NotificationRow>("select id, at, channel, status, detail from cda_funnel.notifications where lead_id = $1 order by at", [id]),
    lead.utm_campaign ? getCampaignBySlug(db, lead.utm_campaign) : Promise.resolve(null),
  ]);
  return { lead, jobs, followups, events, notifications, campaign };
}

/** Moves a lead through the pipeline and keeps the milestone timestamps consistent with it. */
export async function setLeadStatus(db: Db, id: string, status: LeadStatus, note = ""): Promise<boolean> {
  if (!isUuid(id) || !STATUSES.includes(status)) return false;
  const rows = await db.query<{ status: LeadStatus }>("select status from cda_funnel.leads where id = $1", [id]);
  if (rows.length === 0) return false;
  const before = rows[0].status;
  if (before === status && !note) return true;
  await db.query(
    `update cda_funnel.leads set
       status = $2,
       contacted_at = case when $2 in ('new','spam') then contacted_at else coalesce(contacted_at, now()) end,
       booked_at    = case when $3::boolean then coalesce(booked_at, now()) when $4::boolean then null else booked_at end,
       closed_at    = case when $5::boolean then coalesce(closed_at, now()) else null end
     where id = $1`,
    [id, status, BOOKED.includes(status), OPEN.includes(status), CLOSED.includes(status)],
  );
  const change = before === status ? STATUS_LABEL[status] : `${STATUS_LABEL[before]} → ${STATUS_LABEL[status]}`;
  await logEvent(db, id, "status", note ? `${change}. ${note}` : change);
  return true;
}

export async function addNote(db: Db, leadId: string, body: string): Promise<void> {
  if (!isUuid(leadId) || !body.trim()) return;
  await logEvent(db, leadId, "note", body.trim().slice(0, 4000));
}

/** A person overrides the computed influence — always recorded as a manual decision. */
export async function setInfluence(db: Db, leadId: string, influence: Influence, campaignSlug: string, who: string): Promise<void> {
  if (!isUuid(leadId)) return;
  const basis = `Set by hand${who ? ` by ${who}` : ""}`;
  await db.query(
    "update cda_funnel.leads set influence = $2, influence_basis = $3, utm_campaign = $4 where id = $1",
    [leadId, influence, basis, campaignSlug],
  );
  await logEvent(db, leadId, "attribution", `Influence set to “${influence}”${campaignSlug ? `, campaign “${campaignSlug}”` : ""}. ${basis}.`);
}

// ───────────────────────── Jobs ─────────────────────────

export interface JobInput {
  job_type: JobType;
  description: string;
  status: JobStatus;
  scheduled_on: string | null;
  completed_on: string | null;
  reported_revenue_cents: number | null;
  revenue_reported_by: string;
  revenue_reported_on: string | null;
}

async function syncLeadWithJob(db: Db, leadId: string, job: JobInput): Promise<void> {
  const rows = await db.query<{ status: LeadStatus }>("select status from cda_funnel.leads where id = $1", [leadId]);
  const status = rows[0]?.status;
  if (!status) return;
  // A job on the books means the lead is booked; a completed job means it was won.
  if (job.status === "completed" && (OPEN.includes(status) || status === "booked")) {
    await setLeadStatus(db, leadId, "won", "Set automatically: a job was marked completed.");
  } else if (job.status === "booked" && OPEN.includes(status)) {
    await setLeadStatus(db, leadId, "booked", "Set automatically: a job was added.");
  }
}

export async function addJob(db: Db, leadId: string, job: JobInput): Promise<void> {
  await db.query(
    `insert into cda_funnel.jobs (lead_id, job_type, description, status, scheduled_on, completed_on,
       reported_revenue_cents, revenue_reported_by, revenue_reported_on)
     values ($1,$2,$3,$4,$5::date,$6::date,$7,$8,$9::date)`,
    [leadId, job.job_type, job.description, job.status, job.scheduled_on, job.completed_on,
      job.reported_revenue_cents, job.revenue_reported_by, job.revenue_reported_on],
  );
  await logEvent(db, leadId, "job", `Job added: ${job.job_type}${job.description ? ` — ${job.description}` : ""} (${job.status}).`);
  await syncLeadWithJob(db, leadId, job);
}

export async function updateJob(db: Db, jobId: string, job: JobInput): Promise<void> {
  const rows = await db.query<{ lead_id: string }>(
    `update cda_funnel.jobs set job_type=$2, description=$3, status=$4, scheduled_on=$5::date, completed_on=$6::date,
       reported_revenue_cents=$7, revenue_reported_by=$8, revenue_reported_on=$9::date
     where id = $1 returning lead_id`,
    [jobId, job.job_type, job.description, job.status, job.scheduled_on, job.completed_on,
      job.reported_revenue_cents, job.revenue_reported_by, job.revenue_reported_on],
  );
  if (rows.length === 0) return;
  const revenue = job.reported_revenue_cents === null ? "no revenue reported" : `revenue $${(job.reported_revenue_cents / 100).toFixed(2)} reported by ${job.revenue_reported_by}`;
  await logEvent(db, rows[0].lead_id, "job", `Job updated: ${job.job_type} (${job.status}), ${revenue}.`);
  await syncLeadWithJob(db, rows[0].lead_id, job);
}

export interface JobListRow extends Job {
  lead_name: string;
  lead_town: string;
  influence: Influence;
  utm_campaign: string;
}

export async function listJobs(db: Db): Promise<JobListRow[]> {
  return db.query<JobListRow>(
    `select ${JOB_COLS.split(",").map((c) => `j.${c.trim()}`).join(", ")},
       l.name as lead_name, l.town as lead_town, l.influence, l.utm_campaign
     from cda_funnel.jobs j join cda_funnel.leads l on l.id = j.lead_id
     order by coalesce(j.scheduled_on, j.created_at::date) desc, j.created_at desc
     limit 500`,
  );
}

// ───────────────────────── Follow-ups ─────────────────────────

export async function addFollowup(db: Db, leadId: string, dueOn: string, note: string): Promise<void> {
  await db.query("insert into cda_funnel.followups (lead_id, due_on, note) values ($1, $2::date, $3)", [leadId, dueOn, note]);
  await logEvent(db, leadId, "followup", `Follow-up set for ${dueOn}${note ? `: ${note}` : ""}.`);
}

export async function completeFollowup(db: Db, followupId: string): Promise<void> {
  const rows = await db.query<{ lead_id: string; due_on: string }>(
    "update cda_funnel.followups set done_at = now() where id = $1 and done_at is null returning lead_id, due_on::text as due_on",
    [followupId],
  );
  if (rows.length > 0) await logEvent(db, rows[0].lead_id, "followup", `Follow-up due ${rows[0].due_on} marked done.`);
}

export interface FollowupRow extends Followup {
  lead_name: string;
  lead_phone: string;
  lead_status: LeadStatus;
  request_type: RequestType;
}

export async function listOpenFollowups(db: Db): Promise<FollowupRow[]> {
  return db.query<FollowupRow>(
    `select f.id, f.lead_id, f.due_on::text as due_on, f.note, f.done_at,
       l.name as lead_name, l.phone as lead_phone, l.status as lead_status, l.request_type
     from cda_funnel.followups f join cda_funnel.leads l on l.id = f.lead_id
     where f.done_at is null order by f.due_on, f.created_at limit 500`,
  );
}

// ───────────────────────── Notifications & touch events ─────────────────────────

export async function recordNotification(
  db: Db, leadId: string, n: { channel: NotificationRow["channel"]; status: NotificationRow["status"]; detail: string },
): Promise<void> {
  await db.query(
    "insert into cda_funnel.notifications (lead_id, channel, status, detail) values ($1,$2,$3,$4)",
    [leadId, n.channel, n.status, n.detail.slice(0, 500)],
  );
}

export async function recordTouchEvent(
  db: Db, kind: "call_click" | "go_redirect", placement: string, touch: Touch, ipHash: string,
): Promise<void> {
  await db.query(
    `insert into cda_funnel.touch_events
       (kind, placement, landing_path, referrer, utm_source, utm_medium, utm_campaign, utm_content, influence, ip_hash)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [kind, placement.slice(0, 40), touch.landing_path, touch.referrer, touch.utm_source, touch.utm_medium,
      touch.utm_campaign, touch.utm_content, classifyTouch(touch).influence, ipHash],
  );
}

export async function countRecentTouchEventsFromIp(db: Db, ipHash: string, minutes: number): Promise<number> {
  if (!ipHash) return 0;
  const rows = await db.query<{ n: number }>(
    "select count(*)::int as n from cda_funnel.touch_events where ip_hash = $1 and at > now() - make_interval(mins => $2::int)",
    [ipHash, minutes],
  );
  return rows[0].n;
}

// ───────────────────────── Campaigns ─────────────────────────

export type CampaignInput = Omit<Campaign, "id" | "created_at" | "active">;

export async function listCampaigns(db: Db): Promise<Campaign[]> {
  return db.query<Campaign>(`select ${CAMPAIGN_COLS} from cda_funnel.campaigns order by active desc, created_at desc`);
}

export async function getCampaignBySlug(db: Db, slug: string): Promise<Campaign | null> {
  const rows = await db.query<Campaign>(`select ${CAMPAIGN_COLS} from cda_funnel.campaigns where slug = lower($1)`, [slug]);
  return rows[0] ?? null;
}

/** Returns false when the slug is already taken. */
export async function createCampaign(db: Db, c: CampaignInput): Promise<boolean> {
  const rows = await db.query(
    `insert into cda_funnel.campaigns (slug, name, influence, utm_source, utm_medium, utm_content, content_ref, ad_ref,
       intent, starts_on, ends_on, reported_spend_cents, spend_reported_by, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11::date,$12,$13,$14)
     on conflict (slug) do nothing returning id`,
    [c.slug, c.name, c.influence, c.utm_source, c.utm_medium, c.utm_content, c.content_ref, c.ad_ref, c.intent,
      c.starts_on, c.ends_on, c.reported_spend_cents, c.spend_reported_by, c.notes],
  );
  return rows.length > 0;
}

export async function updateCampaign(
  db: Db, id: string, patch: { active: boolean; reported_spend_cents: number | null; spend_reported_by: string; notes: string },
): Promise<void> {
  if (!isUuid(id)) return;
  await db.query(
    "update cda_funnel.campaigns set active = $2, reported_spend_cents = $3, spend_reported_by = $4, notes = $5 where id = $1",
    [id, patch.active, patch.reported_spend_cents, patch.spend_reported_by, patch.notes],
  );
}

// ───────────────────────── Reporting ─────────────────────────

export interface Outcome {
  leads: number;
  contacted: number;
  booked: number;
  won: number;
  revenue_cents: number;
}

const OUTCOME_SELECT = `count(*)::int as leads,
  count(l.contacted_at)::int as contacted,
  count(l.booked_at)::int as booked,
  (count(*) filter (where l.status = 'won'))::int as won,
  coalesce(sum(j.rev), 0)::float8 as revenue_cents`;

const OUTCOME_FROM = `from cda_funnel.leads l
  left join (select lead_id, sum(reported_revenue_cents) as rev from cda_funnel.jobs
             where status <> 'cancelled' group by lead_id) j on j.lead_id = l.id
  where l.status <> 'spam' and ($1::timestamptz is null or l.created_at >= $1::timestamptz)`;

/** Totals for leads created since `since` (null = all time). Spam is excluded everywhere. */
export async function outcomeTotals(db: Db, since: Date | null): Promise<Outcome> {
  const rows = await db.query<Outcome>(`select ${OUTCOME_SELECT} ${OUTCOME_FROM}`, [since]);
  return rows[0];
}

const DIMENSIONS = {
  influence: "l.influence",
  campaign: "lower(l.utm_campaign)",
  content: "l.utm_content",
  landing: "l.landing_path",
  source: "lower(l.utm_source)",
  self_reported: "l.self_reported_source",
  request_type: "l.request_type",
} as const;
export type Dimension = keyof typeof DIMENSIONS;

export interface OutcomeGroup extends Outcome {
  key: string;
}

export async function outcomeBy(db: Db, dimension: Dimension, since: Date | null): Promise<OutcomeGroup[]> {
  const expr = DIMENSIONS[dimension];
  return db.query<OutcomeGroup>(
    `select ${expr} as key, ${OUTCOME_SELECT} ${OUTCOME_FROM} group by ${expr} order by leads desc, key`,
    [since],
  );
}

export async function callClicksBy(db: Db, dimension: "influence" | "campaign", since: Date | null): Promise<Record<string, number>> {
  const expr = dimension === "influence" ? "influence" : "lower(utm_campaign)";
  const rows = await db.query<{ key: string; n: number }>(
    `select ${expr} as key, count(*)::int as n from cda_funnel.touch_events
     where kind = 'call_click' and ($1::timestamptz is null or at >= $1::timestamptz) group by ${expr}`,
    [since],
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.n]));
}

export interface Attention {
  new_leads: number;
  overdue_followups: number;
  due_today: number;
  unnotified: number;
}

/** What needs a person today. `today` is the YYYY-MM-DD date in the business's time zone. */
export async function attention(db: Db, today: string): Promise<Attention> {
  const rows = await db.query<Attention>(
    `select
       (select count(*) from cda_funnel.leads where status = 'new')::int as new_leads,
       (select count(*) from cda_funnel.followups where done_at is null and due_on < $1::date)::int as overdue_followups,
       (select count(*) from cda_funnel.followups where done_at is null and due_on = $1::date)::int as due_today,
       (select count(*) from cda_funnel.leads l where l.origin = 'web_form' and l.status = 'new'
          and not exists (select 1 from cda_funnel.notifications n where n.lead_id = l.id and n.status = 'sent'))::int as unnotified`,
    [today],
  );
  return rows[0];
}

export interface AttributionRow {
  id: string;
  created_at: Date;
  name: string;
  status: LeadStatus;
  booked_at: Date | null;
  request_type: RequestType;
  influence: Influence;
  influence_basis: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  landing_path: string;
  referrer: string;
  ref_code: string;
  self_reported_source: string;
  campaign_name: string | null;
  content_ref: string | null;
  ad_ref: string | null;
  job_count: number;
  revenue_cents: number;
}

/** One row per lead: what influenced it, and what came of it. */
export async function attributionRows(db: Db, since: Date | null, bookedOnly: boolean): Promise<AttributionRow[]> {
  return db.query<AttributionRow>(
    `select l.id, l.created_at, l.name, l.status, l.booked_at, l.request_type, l.influence, l.influence_basis,
       l.utm_source, l.utm_medium, l.utm_campaign, l.utm_content, l.landing_path, l.referrer, l.ref_code,
       l.self_reported_source, c.name as campaign_name, c.content_ref, c.ad_ref,
       coalesce(j.n, 0)::int as job_count, coalesce(j.rev, 0)::float8 as revenue_cents
     from cda_funnel.leads l
     left join cda_funnel.campaigns c on c.slug = lower(l.utm_campaign)
     left join (select lead_id, count(*) filter (where status <> 'cancelled') as n,
                  sum(reported_revenue_cents) filter (where status <> 'cancelled') as rev
                from cda_funnel.jobs group by lead_id) j on j.lead_id = l.id
     where l.status <> 'spam' and ($1::timestamptz is null or l.created_at >= $1::timestamptz)
       and (not $2::boolean or l.booked_at is not null)
     order by l.created_at desc limit 500`,
    [since, bookedOnly],
  );
}

// ───────────────────────── Admin login throttling ─────────────────────────

export async function recordLoginAttempt(db: Db, ipHash: string, ok: boolean): Promise<void> {
  await db.query("insert into cda_funnel.login_attempts (ip_hash, ok) values ($1, $2)", [ipHash, ok]);
}

export async function recentFailedLogins(db: Db, ipHash: string, minutes: number): Promise<number> {
  const rows = await db.query<{ n: number }>(
    "select count(*)::int as n from cda_funnel.login_attempts where ip_hash = $1 and not ok and at > now() - make_interval(mins => $2::int)",
    [ipHash, minutes],
  );
  return rows[0].n;
}
