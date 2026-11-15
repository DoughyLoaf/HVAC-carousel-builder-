# CDA Heating & Cooling — conversion funnel + lead workspace

Cost2shoot's web work for CDA Heating & Cooling, for the Coeur d'Alene /
Spokane Valley / Spokane County area. Two things in one small app:

- **`/`** — one mobile-first page whose only job is to turn a visitor into a
  call or a request: "Call CDA", "Get a replacement estimate", "Request heating
  service", and a guided two-step form.
- **`/admin`** — a private workspace: leads, jobs, reported revenue,
  follow-ups, booked status, outcomes, and which landing page, content, ad,
  referral, review or campaign sat behind each lead and booked job.

It does not replace CDA's existing website; it links to it. It is a separate
app from the carousel builder at the repository root (own `package.json`, own
deploy), and web development is a separate workstream from the existing
$2,500/month social-management scope.

## Where it stands

The app is built and tested. **It is not launched, and it will not let itself
be launched yet.** Run `npm run launch:check` (or open `/admin/launch`) for the
list. Today that list is:

| Blocks launch | What settles it |
|---|---|
| Phone number | CDA confirms `(208) 916-1956` is the number to ring. It comes from public directory listings only. |
| Homepage copy | Every word on the page is AI-drafted. Cost2shoot and CDA approve or rewrite it. |
| Brand colours and logo | The palette is a placeholder. CDA's logo and colours go into `content/site.ts`. |
| Photos + hero photo | The page has photo slots and no photos. The `CDA EDIT` folder was not reachable from where this was built. |
| What happens after a request | CDA confirms who receives lead alerts and that they will be worked. |

Also not done, and not blocking: financing (no Payzer or WEX link to CDA was
found, so the page says nothing about financing), reviews (block built, switched
off), hosting, and a real database and alert channel (see **Deploy**).

## The one file to edit: `content/site.ts`

| Section | What it holds |
|---|---|
| `ledger` | Every fact, number, summary, assumption and idea — each with its class, its source and the date it was checked. |
| `brand` | Colours, wordmark, logo path. |
| `photos` | Photo slots: file name, alt text, inside-a-home flag, homeowner permission. |
| `reviews` | Real reviews only. Empty = the block is hidden. |
| `copy` | Headline, buttons, form questions, FAQ, consent line. |
| `towns` | Towns offered in the form. |
| `services` | The "What we work on" cards, condensed from CDA's own service pages. |

### How facts are kept honest

Each ledger item has one of five classes, and `/admin/launch` shows them in
five separate lists:

1. **verified** — confirmed by a named person on a date. Can appear on the page.
2. **reported** — seen in a listing or search result; not confirmed by CDA.
3. **ai_summary** — written by an AI assistant. A starting point, not evidence.
4. **assumption** — a decision made to keep the build moving.
5. **opportunity** — not built, or built and switched off.

The site enforces this rather than trusting anyone to remember it:

- In **live** mode a public fact is shown only if it is `verified`.
- In **preview** mode unverified facts appear with an "unverified" tag so the
  page can be reviewed.
- `SITE_MODE=live` only takes effect once every `requiredForLaunch` item is
  verified (with `verifiedBy` and `verifiedOn` filled in) and the hero slot has
  a usable photo. Until then the site stays in preview: ribbon on, search
  engines told to stay away.

To verify an item: set `class: "verified"`, fill in `verifiedBy` and
`verifiedOn`, correct `value` if CDA gave a different one, redeploy.

Inside the workspace the same separation holds: lead, booked and won counts
come from the app's own records; **revenue and ad spend are "reported"** —
typed in by a person, stored with their name and the date, and refused without
a name; **call taps** are taps on a button, not confirmed calls.

## Photos

Real CDA photos only — nothing stock or generated is ever substituted.

```bash
npm run photos:import -- "/Users/you/Pictures/CDA EDIT"
```

This copies each photo into `public/photos/` as a web-sized JPEG (long edge
2400px at most) **with its metadata removed** — camera files carry GPS
coordinates, and a customer's address does not belong on a public site.
Originals are untouched. Videos and RAW files are skipped.

Then, in `content/site.ts`, give each slot its `file`, write `alt` text, and
set `permission: "Y"` for anything shot inside a home once the homeowner has
agreed. A slot without a file, alt text or (inside a home) permission is left
off the live page. The before/after slider appears when both of its slots are
usable.

## Run it locally

Needs Node.js 20 or newer.

```bash
cd funnel
npm install
cp .env.example .env.local     # set ADMIN_PASSWORD (10+ chars) and SESSION_SECRET (32+ chars)
npm run dev                    # http://localhost:3000  ·  admin at /admin
```

With no `DATABASE_URL`, a small embedded database is created in `./data/`
(ignored by git). That is for a laptop only — in production the app refuses to
accept leads without a real database, and tells the visitor to call instead.

```bash
npm test             # attribution, validation, launch gate, sessions, storage, reporting, alerts, Postgres driver
npm run typecheck
npm run launch:check
```

## Deploy

Any host that runs Next.js. On Vercel, set the project's **Root Directory** to
`funnel`. Then set the variables in `.env.example`:

1. **Database** — any Postgres. With Supabase, use the *Transaction pooler*
   connection string as `DATABASE_URL`, then create the tables once:
   ```bash
   DATABASE_URL="…" npm run db:migrate
   ```
   Everything lives in its own `cda_funnel` schema with row level security on
   and no policies, so Supabase's public API keys cannot read it.
2. **Admin** — `ADMIN_PASSWORD` and `SESSION_SECRET`. Without both, nobody can
   sign in. Changing either signs everyone out.
3. **Alerts** — email through Resend (`RESEND_API_KEY`, `LEAD_NOTIFY_EMAIL_TO`,
   `LEAD_NOTIFY_EMAIL_FROM`) and/or a webhook (`LEAD_NOTIFY_WEBHOOK_URL`; a
   Slack incoming webhook works as-is, Zapier or Make can turn it into a text).
   With neither, leads are saved but nobody is told — the admin says so in red.
4. **`SITE_URL`** — the public address.
5. **`SITE_MODE=live`** — last, once `npm run launch:check` is clean.

**Not yet exercised against the real services:** a Supabase connection (the
Postgres driver and migration script are tested over the Postgres wire protocol
against an embedded server, not against Supabase's pooler or TLS setup), and a
live Resend send (tested against a stand-in). Send one test request after the
first deploy and check that it shows in `/admin` and that the alert arrives.

## How a request flows

1. The page notes what brought the visitor: UTM tags, ad click IDs, a `ref`
   code, the referrer and the landing path — on the first visit and on the
   visit that converts. First-party browser storage only; no cookies, no third
   parties.
2. The form posts to `/api/leads`. The server validates it, re-derives the
   attribution itself, saves the lead, then sends the alert and records whether
   it arrived.
3. If saving fails, the visitor is told so and asked to call. A request is
   never reported as received when it was not.
4. Taps on any "Call CDA" button are logged with the same attribution.

Abuse control: a hidden field files bot submissions under **Spam** (kept, never
alerted on), five requests per hour per connection, and requests from other
sites are refused. IP addresses are stored only as a one-way hash.

## Attribution and campaigns

Under **Campaigns**, create one entry per ad, reel, carousel, review ask,
referral push or mailer. Each gets:

- a short link — `/go/<name>` — for a bio, QR code or printed card, and
- a full tagged link for an ad's destination URL.

Every lead is classified into one kind of influence — paid ad, social content,
referral, review / listing, campaign, unpaid search, another website, or direct
— and the rule that decided it is stored and shown beside it. The visit that
sent the form decides; if that visit carried nothing, the first visit from the
same browser does, and its campaign gets the credit. What the person answers to
"How did you hear about CDA?" is shown next to the tracked answer and never
overrides it. Staff can correct a lead by hand; the correction is recorded with
their name.

The **Attribution** page rolls this up by influence, campaign, content tag,
landing page and self-reported source, and lists every lead and booked job with
what sat behind it. **Leads → Export CSV** gives the same list as a spreadsheet.

Phone leads never touch the form: add them with **Leads → Add a lead**.

## Layout

| Path | What |
|---|---|
| `content/site.ts` | Facts ledger, brand, photo slots, copy. |
| `db/migrations/` | Database schema (plain SQL). |
| `src/app/page.tsx` | The homepage. |
| `src/app/api/leads`, `api/events`, `go/[slug]` | Lead intake, call-tap logging, campaign short links. |
| `src/app/admin/` | The private workspace. |
| `src/lib/attribution.ts` | How a visit is read and classified. |
| `src/lib/launch.ts` | The launch gate and the verified-facts rule. |
| `src/lib/store.ts` | Every database query, including the reports. |
| `src/lib/notify.ts` | New-lead alerts. |
| `src/lib/session.ts`, `src/proxy.ts` | Admin sign-in. |
| `scripts/` | `db:migrate`, `photos:import`, `launch:check`. |
