-- CDA Heating & Cooling funnel — initial schema.
--
-- Everything lives in its own schema (cda_funnel) with row level security on
-- and no policies. On Supabase that means the public API keys (anon /
-- authenticated) cannot read or write any of it; only the server, connecting
-- with the database password, can.

create schema if not exists cda_funnel;

-- Campaigns: one row per ad, content piece, referral push, review ask, mailer…
-- `slug` is the join key: it is the utm_campaign value and the /go/<slug> link.
create table cda_funnel.campaigns (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  slug          text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  name          text not null,
  influence     text not null check (influence in ('ad','content','referral','review','campaign')),
  utm_source    text not null default '',
  utm_medium    text not null default '',
  utm_content   text not null default '',
  content_ref   text not null default '',   -- e.g. "Carousel 4", "Reel 2"
  ad_ref        text not null default '',   -- ad / ad set name or ID
  intent        text not null default '' check (intent in ('','replacement_estimate','heating_service')),
  starts_on     date,
  ends_on       date,
  reported_spend_cents integer check (reported_spend_cents is null or reported_spend_cents >= 0),
  spend_reported_by    text not null default '',
  notes         text not null default '',
  active        boolean not null default true
);

create table cda_funnel.leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  origin        text not null check (origin in ('web_form','manual')),

  -- The request
  request_type  text not null check (request_type in ('replacement_estimate','heating_service','other')),
  urgency       text not null default '' check (urgency in ('','urgent','soon','planning')),
  town          text not null default '',
  zip           text not null default '',
  message       text not null default '',

  -- The person
  name          text not null,
  phone         text not null default '',
  email         text not null default '',
  preferred_contact text not null default 'either' check (preferred_contact in ('call','text','either')),
  consent_text  text not null default '',   -- the exact consent wording shown at submit

  -- Attribution. These columns hold the tags of the visit that gets the credit:
  -- the visit that sent the form, or — when that visit carried nothing — the
  -- first visit seen from the same browser. `influence_basis` says which.
  landing_path  text not null default '',
  referrer      text not null default '',
  utm_source    text not null default '',
  utm_medium    text not null default '',
  utm_campaign  text not null default '',
  utm_content   text not null default '',
  utm_term      text not null default '',
  gclid         text not null default '',
  fbclid        text not null default '',
  msclkid       text not null default '',
  ref_code      text not null default '',
  -- Both visits, exactly as captured, so the credit can always be re-examined.
  last_touch    jsonb,
  first_touch   jsonb,
  -- … what the person told us …
  self_reported_source text not null default '',
  -- … and the conclusion, with the rule that produced it.
  influence     text not null default 'direct'
                check (influence in ('ad','content','referral','review','campaign','search','website','direct')),
  influence_basis text not null default '',

  -- Pipeline
  status        text not null default 'new'
                check (status in ('new','contacted','booked','won','lost','unreachable','out_of_area','spam')),
  contacted_at  timestamptz,
  booked_at     timestamptz,
  closed_at     timestamptz,

  -- Abuse control. The IP itself is never stored.
  ip_hash       text not null default '',
  user_agent    text not null default ''
);
create index leads_created_idx  on cda_funnel.leads (created_at desc);
create index leads_status_idx   on cda_funnel.leads (status);
create index leads_campaign_idx on cda_funnel.leads (lower(utm_campaign));
create index leads_ip_idx       on cda_funnel.leads (ip_hash, created_at);

create table cda_funnel.jobs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  lead_id       uuid not null references cda_funnel.leads (id) on delete cascade,
  job_type      text not null check (job_type in ('replacement','repair','maintenance','other')),
  description   text not null default '',
  status        text not null default 'booked' check (status in ('booked','completed','cancelled')),
  scheduled_on  date,
  completed_on  date,
  -- Revenue is always a number somebody reported, never one this app measured.
  reported_revenue_cents integer check (reported_revenue_cents is null or reported_revenue_cents >= 0),
  revenue_reported_by    text not null default '',
  revenue_reported_on    date,
  constraint revenue_needs_reporter
    check (reported_revenue_cents is null or length(trim(revenue_reported_by)) > 0)
);
create index jobs_lead_idx on cda_funnel.jobs (lead_id);

create table cda_funnel.followups (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  lead_id       uuid not null references cda_funnel.leads (id) on delete cascade,
  due_on        date not null,
  note          text not null default '',
  done_at       timestamptz
);
create index followups_due_idx on cda_funnel.followups (due_on) where done_at is null;

-- Timeline for a lead: notes, status changes, job and follow-up changes.
create table cda_funnel.lead_events (
  id            uuid primary key default gen_random_uuid(),
  at            timestamptz not null default now(),
  lead_id       uuid not null references cda_funnel.leads (id) on delete cascade,
  kind          text not null check (kind in ('created','note','status','job','followup','attribution')),
  body          text not null default ''
);
create index lead_events_lead_idx on cda_funnel.lead_events (lead_id, at);

-- One row per notification attempt, so a failed or unconfigured alert is visible.
create table cda_funnel.notifications (
  id            uuid primary key default gen_random_uuid(),
  at            timestamptz not null default now(),
  lead_id       uuid not null references cda_funnel.leads (id) on delete cascade,
  channel       text not null check (channel in ('email','webhook','none')),
  status        text not null check (status in ('sent','failed','not_configured')),
  detail        text not null default ''
);
create index notifications_lead_idx on cda_funnel.notifications (lead_id);

-- Things that happened before a lead existed: taps on a call button, /go/ link
-- visits. A call tap is a tap, not a confirmed phone call.
create table cda_funnel.touch_events (
  id            uuid primary key default gen_random_uuid(),
  at            timestamptz not null default now(),
  kind          text not null check (kind in ('call_click','go_redirect')),
  placement     text not null default '',
  landing_path  text not null default '',
  referrer      text not null default '',
  utm_source    text not null default '',
  utm_medium    text not null default '',
  utm_campaign  text not null default '',
  utm_content   text not null default '',
  influence     text not null default 'direct',
  ip_hash       text not null default ''
);
create index touch_events_at_idx on cda_funnel.touch_events (at desc);

create table cda_funnel.login_attempts (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  ip_hash       text not null,
  ok            boolean not null
);
create index login_attempts_idx on cda_funnel.login_attempts (ip_hash, at);

alter table cda_funnel.campaigns      enable row level security;
alter table cda_funnel.leads          enable row level security;
alter table cda_funnel.jobs           enable row level security;
alter table cda_funnel.followups      enable row level security;
alter table cda_funnel.lead_events    enable row level security;
alter table cda_funnel.notifications  enable row level security;
alter table cda_funnel.touch_events   enable row level security;
alter table cda_funnel.login_attempts enable row level security;
