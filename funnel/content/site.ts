/**
 * THE ONE FILE TO EDIT.
 *
 * Everything the funnel says about CDA Heating & Cooling comes from here: the
 * ledger of facts (with where each one came from), the brand tokens, the photo
 * slots and the page copy.
 *
 * The rule the site enforces:
 *   - A public fact is shown to visitors only when its class is "verified".
 *   - In preview mode, unverified public facts are shown with a visible marker
 *     so the page can be reviewed. In live mode they are simply left out.
 *   - The site refuses to go live while any `requiredForLaunch` item is not
 *     verified (see src/lib/launch.ts).
 *
 * To verify something: change `class` to "verified", fill in `verifiedBy` and
 * `verifiedOn`, and correct `value` if CDA gave a different one.
 *
 * Where the line is drawn in this file:
 *   - What CDA's own live website plainly states about who and where they are
 *     (phone, address, towns, services, colours) is "verified" — it was read
 *     directly on cdaheating.com.
 *   - What CDA's website claims about itself (licensed, years of experience,
 *     24/7, guarantees, ratings, prices) is "reported": CDA publishes it, but
 *     nobody has checked it independently or confirmed CDA wants it repeated
 *     on an ad landing page.
 */

export type LedgerClass = "verified" | "reported" | "ai_summary" | "assumption" | "opportunity";

export interface LedgerItem {
  id: string;
  class: LedgerClass;
  label: string;
  /** The fact, number, summary, assumption or idea itself. */
  value: string;
  /** Where it came from, in plain words. */
  source: string;
  /** Date the source was last looked at (YYYY-MM-DD). */
  checkedOn: string;
  verifiedBy?: string;
  verifiedOn?: string;
  /** Shown to visitors (subject to the rule above) or internal only. */
  audience: "public" | "internal";
  /** The site stays in preview until this item is verified. */
  requiredForLaunch?: boolean;
  /** What has to happen to settle it. */
  toVerify?: string;
}

const RESEARCH_DATE = "2026-11-15";
const BRIEF = { verifiedBy: "Cost2shoot (project brief)", verifiedOn: RESEARCH_DATE };
/** For facts read on the pages themselves, not through a search engine. */
const SITE = { verifiedBy: "Read directly on CDA's live website, cdaheating.com", verifiedOn: RESEARCH_DATE };
const CLAIM = "Published by CDA on cdaheating.com (read directly on 2026-11-15). It is CDA's own claim: not checked independently, and CDA has not been asked whether to repeat it on this page.";
const LISTINGS = "Third-party listings seen in web search results on 2026-11-15, not opened directly.";

export const ledger: LedgerItem[] = [
  // ───────────────────────── Verified ─────────────────────────
  {
    id: "business.name",
    class: "verified",
    label: "Business name",
    value: "CDA Heating & Cooling",
    source: "Project brief from Cost2shoot; the same name is used across cdaheating.com.",
    checkedOn: RESEARCH_DATE,
    ...BRIEF,
    audience: "public",
  },
  {
    id: "funnel.targetArea",
    class: "verified",
    label: "Area this funnel targets",
    value: "Coeur d’Alene, Spokane Valley and Spokane County",
    source: "Project brief from Cost2shoot. This is the campaign target; CDA's site also covers Bonner and Shoshone counties.",
    checkedOn: RESEARCH_DATE,
    ...BRIEF,
    audience: "public",
  },
  {
    id: "scope.webSeparate",
    class: "verified",
    label: "Scope",
    value: "Web development (this funnel and its admin) is a separate workstream from the existing $2,500/month social-management scope.",
    source: "Project brief from Cost2shoot. No price for the web work is recorded here.",
    checkedOn: RESEARCH_DATE,
    ...BRIEF,
    audience: "internal",
  },
  {
    id: "business.phone",
    class: "verified",
    label: "Phone number",
    value: "(208) 916-1956",
    source: "cdaheating.com: the header call button on every page (tel:+12089161956), the contact section and the page's business data.",
    checkedOn: RESEARCH_DATE,
    ...SITE,
    audience: "public",
    requiredForLaunch: true,
  },
  {
    id: "business.website",
    class: "verified",
    label: "Existing website",
    value: "https://www.cdaheating.com/",
    source: "cdaheating.com is the live site. cdaheating.net redirects to it and is the domain of CDA's email. A pages.dev address holds a build copy of the same site.",
    checkedOn: RESEARCH_DATE,
    ...SITE,
    audience: "public",
  },
  {
    id: "business.address",
    class: "verified",
    label: "Office address",
    value: "16436 W Prairie Ave, Hauser, ID 83854",
    source: "cdaheating.com contact section, footer and business data.",
    checkedOn: RESEARCH_DATE,
    ...SITE,
    audience: "internal",
  },
  {
    id: "contact.email",
    class: "verified",
    label: "Contact email",
    value: "eddiep@cdaheating.net",
    source: "cdaheating.com business data. The visible address on the page is hidden from robots, so only the data copy was read.",
    checkedOn: RESEARCH_DATE,
    ...SITE,
    audience: "internal",
    toVerify: "Not shown on the funnel. Ask CDA whether this is where new-lead alerts should go (LEAD_NOTIFY_EMAIL_TO).",
  },
  {
    id: "area.towns",
    class: "verified",
    label: "Towns offered in the form",
    value:
      "Kootenai County: Coeur d’Alene, Post Falls, Hayden, Rathdrum, Spirit Lake, Dalton Gardens, Huetter, Hauser, Athol. Spokane County: Spokane, Spokane Valley, Liberty Lake, Cheney, Airway Heights, Medical Lake, Millwood, Deer Park, Mead, Nine Mile Falls.",
    source: "cdaheating.com/locations lists exactly these towns under the two counties, each with its own page. Bonner and Shoshone county towns are on the site too and left off this form because they fall outside the funnel's target area.",
    checkedOn: RESEARCH_DATE,
    ...SITE,
    audience: "internal",
  },
  {
    id: "services.list",
    class: "verified",
    label: "Services",
    value: "Furnace repair, AC repair, heat pump service, ductless mini-splits, maintenance and tune-ups, thermostat service",
    source: "cdaheating.com homepage, “What We Help Homeowners Fix”. The descriptions on the funnel are CDA's own, word for word. The site's business data also lists heating and cooling installation; there is no page for replacements.",
    checkedOn: RESEARCH_DATE,
    ...SITE,
    audience: "public",
  },
  {
    id: "guide.repairOrReplace",
    class: "verified",
    label: "Repair-or-replace guide",
    value: "Three signals that point toward repair and three that point toward replacement.",
    source: "cdaheating.com/repair-or-replace. The headings and sentences on the funnel are CDA's own, word for word.",
    checkedOn: RESEARCH_DATE,
    ...SITE,
    audience: "public",
  },
  {
    id: "brand.palette",
    class: "verified",
    label: "Brand colours, typeface and logo mark",
    value: "Blue #2a7ab5 (header), red #e02424 (main buttons), dark grey #252525, navy #102536; Assistant typeface; pill-shaped buttons; the name set in bold capitals next to a square flame mark.",
    source: "cdaheating.com stylesheet and /assets/logo-mark.svg (the logo named in the site's business data). The site's header shows the name as text; no full logo file was found there.",
    checkedOn: RESEARCH_DATE,
    ...SITE,
    audience: "internal",
    requiredForLaunch: true,
    toVerify: "If CDA has a fuller logo (the one on the trucks), drop it into public/brand/ and set `brand.logo`.",
  },
  {
    id: "profiles.social",
    class: "verified",
    label: "CDA's profiles elsewhere",
    value: "Google Maps (cid 16626846853773964737), facebook.com/CDAHEATING, LinkedIn (cda-heating-cooling), Yelp (cda-heating-and-cooling-hauser-2), Nextdoor, BBB (CDA Heating & Cooling Inc), Apple Maps, MapQuest.",
    source: "Listed in cdaheating.com's business data. The profiles themselves were not opened.",
    checkedOn: RESEARCH_DATE,
    ...SITE,
    audience: "internal",
  },

  // ───────────────────────── Reported (not yet verified) ─────────────────────────
  {
    id: "claim.local",
    class: "reported",
    label: "Local ownership",
    value: "Locally owned and operated",
    source: CLAIM,
    checkedOn: RESEARCH_DATE,
    audience: "public",
    toVerify: "CDA's OK to repeat it here.",
  },
  {
    id: "claim.licensed",
    class: "reported",
    label: "Licensing",
    value: "Licensed, bonded and insured in Idaho and Washington",
    source: `${CLAIM} No licence number appears on the site. BuildZoom lists a Kootenai County contractor licence at the Hauser address.`,
    checkedOn: RESEARCH_DATE,
    audience: "public",
    toVerify: "Get the Idaho and Washington licence numbers from CDA and check them against the state lookups.",
  },
  {
    id: "claim.experience",
    class: "reported",
    label: "Experience",
    value: "20+ years of HVAC experience",
    source: `${CLAIM} The site ties the figure to co-owner Eddie Proulx (“residential new construction, retrofits, and commercial work”), not to the company's age.`,
    checkedOn: RESEARCH_DATE,
    audience: "public",
    toVerify: "CDA's OK on the figure and wording.",
  },
  {
    id: "claim.emergency",
    class: "reported",
    label: "Emergency service",
    value: "24/7 emergency service",
    source: `${CLAIM} Shown beside the phone number on every page as “Call anytime”.`,
    checkedOn: RESEARCH_DATE,
    audience: "public",
    toVerify: "Confirm with CDA that the line is answered around the clock before an ad promises it.",
  },
  {
    id: "claim.positioning",
    class: "reported",
    label: "How CDA describes itself",
    value: "Safety-first diagnosis, clear options, and respectful in-home service.",
    source: `${CLAIM} This is the line in the site's footer.`,
    checkedOn: RESEARCH_DATE,
    audience: "public",
    toVerify: "CDA's OK to repeat it here.",
  },
  {
    id: "price.diagnostic",
    class: "reported",
    label: "Diagnostic fee",
    value: "$220",
    source: `${CLAIM} The homepage has an “Upfront pricing” section: the fee “covers the technician's time, travel, and a full system evaluation. No surprise charges. No pressure to approve work on the spot.”`,
    checkedOn: RESEARCH_DATE,
    audience: "public",
    toVerify: "Prices go stale. Confirm the current fee with CDA, and that they want it on an ad landing page, before it shows in live mode. It appears only in one answer under Common questions.",
  },
  {
    id: "claim.guarantee",
    class: "reported",
    label: "Guarantee",
    value: "Satisfaction guaranteed",
    source: CLAIM,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Kept off the funnel. A guarantee needs terms; ask CDA what it covers before advertising it.",
  },
  {
    id: "claim.fiveStar",
    class: "reported",
    label: "Rating",
    value: "“5 Star Rated”",
    source: `${CLAIM} The site names no platform and no count. Yelp showed 5.0 from 3 reviews. ${LISTINGS}`,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Kept off the funnel. Get the Google Business Profile rating and review count from CDA.",
  },
  {
    id: "reviews.site",
    class: "reported",
    label: "Testimonials on CDA's site",
    value: "“Very professional and put us at ease right away.” (Spokane homeowner) · “They explained what failed, what mattered now, and what could wait.” (Post Falls homeowner) · “No hidden fees or pressure. Just a straight answer and a clean repair.” (Liberty Lake homeowner)",
    source: `${CLAIM} The quotes carry no names and no review platform.`,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Kept off the funnel. Unnamed quotes cannot be shown as reviews; ask CDA for real, named reviews and permission to quote them.",
  },
  {
    id: "claim.certifications",
    class: "reported",
    label: "Certifications",
    value: "EPA 608 Certified, NATE Certified",
    source: `${CLAIM} Listed under co-owner Eddie Proulx.`,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Kept off the funnel until CDA confirms who holds them.",
  },
  {
    id: "business.ownership",
    class: "reported",
    label: "Ownership",
    value: "“Owner-operated by long-time Coeur d’Alene residents.” Co-owner Eddie Proulx is named and pictured on the site. A MapQuest profile adds co-owner Dale Thomas and a 2022 start.",
    source: `${CLAIM} ${LISTINGS}`,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Confirm with CDA before naming anyone on this page.",
  },
  {
    id: "business.hours",
    class: "reported",
    label: "Office hours",
    value: "Not stated on CDA's site",
    source: `The site says “we follow up as soon as we can during business hours” without giving the hours. One third-party directory shows Monday–Friday, 8am–5pm. ${LISTINGS}`,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Ask CDA for office hours if they want them on the page.",
  },
  {
    id: "contact.erika",
    class: "reported",
    label: "CDA contact for sign-off",
    value: "Erika (CDA)",
    source: "Named as the person to verify plan details in this repository's carousel registry.",
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Confirm Erika is the right person to sign off the items on this page.",
  },

  // ───────────────────────── AI-generated summaries ─────────────────────────
  {
    id: "ai.webPresence",
    class: "ai_summary",
    label: "Summary of CDA's website",
    value:
      "cdaheating.com is a repair-led site: “HVAC Repair in North Idaho and Spokane County”, built around a safety-first diagnostic, clear repair options and respectful in-home service. It leads with a $220 diagnostic fee as upfront pricing, a three-step process (reach out, diagnose safely, review options and fix), six service pages, a repair-or-replace guide, a symptom guide, and a page for every town across Spokane, Kootenai, Bonner and Shoshone counties. Contact is by phone or email only — there is no request form. Nothing on the pages read mentions financing, Payzer, WEX or a maintenance plan's terms, and there is no page about replacement or installation. The large van photo at the top of the site has garbled lettering and looks computer-generated.",
    source: "Written by an AI assistant after reading the homepage, contact, service-area, repair-or-replace and privacy pages directly on 2026-11-15. A summary, not a record: check the page before relying on a detail.",
    checkedOn: RESEARCH_DATE,
    audience: "internal",
  },
  {
    id: "ai.pageCopy",
    class: "ai_summary",
    label: "Homepage copy",
    value: "The headline, button labels, form questions and most answers under Common questions were drafted by an AI assistant. The services, the repair-or-replace signals and the three steps under “What happens next” use CDA's own published wording.",
    source: "content/site.ts → `copy`, `services`.",
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    requiredForLaunch: true,
    toVerify: "Cost2shoot and CDA read the page and approve or rewrite the copy.",
  },

  // ───────────────────────── Assumptions ─────────────────────────
  {
    id: "photos.source",
    class: "assumption",
    label: "Photos",
    value: "The page has named photo slots and no photos. The “CDA EDIT” folder could not be reached from the build environment. No stock or AI images are used in their place, and the van image from CDA's own site is not used because it looks computer-generated.",
    source: "Build environment.",
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    requiredForLaunch: true,
    toVerify: "Run `npm run photos:import -- \"/path/to/CDA EDIT\"`, assign files to slots in `photos` below, and record homeowner permission for anything shot inside a home.",
  },
  {
    id: "offer.replacement",
    class: "assumption",
    label: "Replacement estimates",
    value: "The funnel offers replacement estimates as one of its three calls to action.",
    source: "Project brief. CDA's site lists “heating and cooling installation” in its business data and has a repair-or-replace guide, but no page that offers replacement estimates.",
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Confirm with CDA that they want replacement-estimate requests and who handles them.",
  },
  {
    id: "process.callback",
    class: "assumption",
    label: "What happens after a request",
    value: "CDA is alerted to each request and follows up by call or text.",
    source: "Assumed workflow. The page says CDA follows up “as soon as we can during business hours” — CDA's own wording for email enquiries — and promises no time frame.",
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    requiredForLaunch: true,
    toVerify: "Confirm with CDA who receives lead alerts, on which email or phone, and that they will work them.",
  },
  {
    id: "legal.consent",
    class: "assumption",
    label: "Contact consent wording",
    value: "The line under the Send button (content/site.ts → `copy.form.consent`) is stored with every lead exactly as shown.",
    source: "Drafted for this build. CDA's own site has no request form and no consent wording to match. Not reviewed by a lawyer.",
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "CDA approves the wording. Marketing texts (as opposed to replies about this request) would need separate, explicit consent.",
  },
  {
    id: "attribution.model",
    class: "assumption",
    label: "How a lead's influence is decided",
    value: "The visit that sent the form decides. If that visit carries no tags or referrer, the first visit seen from the same browser decides. What the person says in “How did you hear about us?” is shown next to it and never overrides it automatically.",
    source: "Design decision in src/lib/attribution.ts.",
    checkedOn: RESEARCH_DATE,
    audience: "internal",
  },

  // ───────────────────────── Future opportunities ─────────────────────────
  {
    id: "financing.payzer",
    class: "opportunity",
    label: "Financing (Payzer / WEX)",
    value: "The page says nothing about financing. If CDA does use Payzer (now part of WEX), add its application link as a third call to action for replacement estimates.",
    source: "No page read on cdaheating.com mentions financing, Payzer or WEX, and nothing turned up in search results either.",
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Ask CDA whether they offer financing, through whom, and for the customer-facing application link and any required disclosure wording.",
  },
  {
    id: "opp.reviews",
    class: "opportunity",
    label: "Reviews on the page",
    value: "A reviews block is built and switched off. Turn it on with real Google reviews once CDA shares the rating, count and permission to quote. CDA's Google, Yelp, Nextdoor and BBB profiles are listed above.",
    source: "content/site.ts → `reviews`.",
    checkedOn: RESEARCH_DATE,
    audience: "internal",
  },
  {
    id: "opp.callTracking",
    class: "opportunity",
    label: "Call tracking",
    value: "Today the site counts taps on “Call CDA”, not answered calls. A tracking number per campaign would tie phone calls to sources.",
    source: "Product gap.",
    checkedOn: RESEARCH_DATE,
    audience: "internal",
  },
  {
    id: "opp.maintenancePlan",
    class: "opportunity",
    label: "Maintenance plan offer",
    value: "Left off the page. Plan perks, frequency and timing are still waiting on CDA (the same open question that blocks Carousel 8). CDA's site has a tune-ups page but no plan terms.",
    source: "carousel-registry.json in this repository; cdaheating.com.",
    checkedOn: RESEARCH_DATE,
    audience: "internal",
  },
  {
    id: "opp.crm",
    class: "opportunity",
    label: "CRM connection",
    value: "Leads and jobs live in this app's own database. A sync to CDA's dispatch or CRM tool, or to the carousel builder's job_id field, is not built.",
    source: "Product gap.",
    checkedOn: RESEARCH_DATE,
    audience: "internal",
  },
  {
    id: "opp.cooling",
    class: "opportunity",
    label: "Cooling-season version",
    value: "The page is written for heating season. A spring/summer variant would need new copy and photos.",
    source: "Product gap.",
    checkedOn: RESEARCH_DATE,
    audience: "internal",
  },
];

/** Brand tokens, taken from cdaheating.com (see ledger item `brand.palette`). */
export const brand = {
  wordmark: "CDA Heating & Cooling",
  /** CDA's square flame mark, shown beside the name. Path under /public; empty = name only. */
  mark: "/brand/logo-mark.svg",
  /** A full logo, if CDA supplies one, replaces the mark and the name. Path under /public. */
  logo: "",
  colors: {
    ink: "#252525",
    paper: "#f7f8fa",
    brand: "#2a7ab5",
    brandDeep: "#102536",
    accent: "#e02424",
    accentInk: "#ffffff",
  },
};

export interface PhotoSlot {
  id: string;
  /** What belongs here — a shot list for whoever picks the photos. */
  wanted: string;
  /** File name inside public/photos/, e.g. "hero.jpg". Empty = not assigned yet. */
  file: string;
  /** Describes the actual photo for screen readers. Required once a file is set. */
  alt: string;
  /** Was this shot inside a customer's home? */
  insideHome: boolean;
  /** Homeowner permission on record: "Y", "N" or "" (not asked yet). */
  permission: "Y" | "N" | "";
  caption?: string;
}

export const photos: PhotoSlot[] = [
  { id: "hero", wanted: "A CDA tech at work on a furnace or heat pump, face or branded gear visible, room for text on the left.", file: "", alt: "", insideHome: true, permission: "" },
  { id: "before", wanted: "The old furnace or unit before a replacement, shot square-on.", file: "", alt: "", insideHome: true, permission: "" },
  { id: "after", wanted: "The new unit in the same spot, same angle as the “before”.", file: "", alt: "", insideHome: true, permission: "" },
  { id: "gallery-1", wanted: "The crew or a tech by the CDA truck.", file: "", alt: "", insideHome: false, permission: "", caption: "" },
  { id: "gallery-2", wanted: "Hands-on detail: gauges, a filter change, sheet-metal work.", file: "", alt: "", insideHome: true, permission: "", caption: "" },
  { id: "gallery-3", wanted: "A finished install, clean and labelled.", file: "", alt: "", insideHome: true, permission: "", caption: "" },
  { id: "gallery-4", wanted: "A tech talking a homeowner through the thermostat or the work done.", file: "", alt: "", insideHome: true, permission: "", caption: "" },
];

/** Real reviews only. Each needs the reviewer's wording, where it was posted, and permission to quote. */
export const reviews: { quote: string; name: string; town: string; platform: string; verifiedBy: string; verifiedOn: string }[] = [];

/** Homepage copy. See ledger item `ai.pageCopy` for which parts are AI-drafted and which are CDA's own. */
export const copy = {
  metaTitle: "Heating service and replacement estimates — CDA Heating & Cooling",
  metaDescription: "Request heating service or a replacement estimate from CDA Heating & Cooling in Coeur d’Alene, Spokane Valley and Spokane County.",
  hero: {
    eyebrow: "Coeur d’Alene · Spokane Valley · Spokane County",
    headline: "Heat acting up? Tell us what’s going on.",
    sub: "Request heating service or a replacement estimate from CDA Heating & Cooling. Two short steps, then we follow up.",
  },
  cta: { call: "Call CDA", estimate: "Get a replacement estimate", service: "Request heating service" },
  form: {
    title: "Start your request",
    step1: "What do you need?",
    step2: "Where should we reach you?",
    types: [
      { id: "heating_service", title: "Heating service", blurb: "No heat, odd noises, or it can’t keep up." },
      { id: "replacement_estimate", title: "Replacement estimate", blurb: "You’re pricing out a new furnace or heat pump." },
      { id: "other", title: "Something else", blurb: "Cooling, a tune-up, a thermostat, or a question." },
    ],
    urgency: [
      { id: "urgent", label: "No heat right now" },
      { id: "soon", label: "This week" },
      { id: "planning", label: "Just planning" },
    ],
    urgentNote: "No heat right now? Calling is the fastest way to reach us.",
    heard: ["Instagram", "Facebook", "Google search", "Google review", "A neighbor or friend", "Saw the truck", "Something else"],
    consent: "By sending this, you agree CDA Heating & Cooling may call or text you about this request.",
    success: "Your request is in.",
    successBody: "CDA has your details and will follow up by call or text as soon as we can during business hours. If the house is getting cold, don’t wait on us — call.",
  },
  services: { title: "What we help homeowners fix" },
  /** CDA's own three steps (“What Happens When You Call”), with step 1 adapted to include this form. */
  steps: [
    { title: "Reach out", body: "Call, or send the two-step request. We listen first, confirm the symptom, and set expectations on timing." },
    { title: "Diagnose safely", body: "We inspect the system, start with safety-critical checks, and find the root cause instead of guessing." },
    { title: "Review options and fix", body: "We explain the findings in plain language, walk through the options, and verify the approved repair." },
  ],
  stepsTitle: "What happens next",
  /** CDA's repair-or-replace guide, word for word. Shown under ledger item `guide.repairOrReplace`. */
  repairOrReplace: {
    title: "Repair it, or replace it?",
    lede: "The right decision starts with the real cause. We diagnose first, then show you the reasoning behind repair versus replacement.",
    repair: {
      tab: "Signs it’s a repair",
      signals: [
        { title: "The issue is isolated", body: "One failed component does not automatically mean the whole system is declining." },
        { title: "The system is still operating safely", body: "If the safety checks pass, repair usually stays on the table." },
        { title: "Major failures are not repeating", body: "A short repair history usually points toward fixing the current issue instead of replacing early." },
      ],
    },
    replace: {
      tab: "Signs it’s time to replace",
      signals: [
        { title: "Safety-related failures are present", body: "Cracked components, combustion concerns, or other safety faults change the conversation fast." },
        { title: "Core parts are failing repeatedly", body: "When the same major systems keep failing, repair costs and downtime start stacking up." },
        { title: "Ownership cost keeps climbing", body: "Repeated repairs, performance loss, and higher utility bills can make replacement the cleaner path." },
      ],
    },
  },
  beforeAfter: { title: "Old unit out. New unit in.", hint: "Drag to compare" },
  gallery: { title: "Our crew, on real jobs" },
  faq: [
    { q: "What happens after I send a request?", a: "Your details go straight to CDA. We follow up by call or text as soon as we can during business hours to confirm the symptom, your city, and the right next step." },
    { q: "My heat is out right now. Should I still use the form?", a: "Call instead. The form is there if you can’t talk right now, but a call reaches us fastest." },
    {
      q: "Does it cost anything?",
      a: "Sending a request costs nothing. Ask about visit and estimate costs when we follow up.",
      /** Used instead of `a` when the ledger lets the diagnostic fee be shown. `{fee}` is replaced with it. */
      factId: "price.diagnostic",
      aWithFact: "Sending a request costs nothing. Every service call starts with a {fee} safety-first diagnostic, which covers the technician’s time, travel, and a full system evaluation — no surprise charges, and no pressure to approve work on the spot.",
    },
    { q: "I’m not sure if I need a repair or a replacement.", a: "That’s common. Pick “Heating service” and tell us what you’re seeing. A diagnosis gives you the technical reason behind the recommendation, not just a guess based on age." },
  ] as { q: string; a: string; factId?: string; aWithFact?: string }[],
  privacy: "We use what you send only to respond to your request. This page remembers which link or ad brought you here so CDA knows what’s working; it sets no advertising cookies.",
};

/** Towns offered in the form, grouped the way CDA's site groups them (see ledger item `area.towns`). */
export const townGroups: { county: string; towns: string[] }[] = [
  { county: "Kootenai County, Idaho", towns: ["Coeur d’Alene", "Post Falls", "Hayden", "Rathdrum", "Spirit Lake", "Dalton Gardens", "Huetter", "Hauser", "Athol"] },
  { county: "Spokane County, Washington", towns: ["Spokane", "Spokane Valley", "Liberty Lake", "Cheney", "Airway Heights", "Medical Lake", "Millwood", "Deer Park", "Mead", "Nine Mile Falls"] },
];
export const towns = townGroups.flatMap((g) => g.towns);

/**
 * The services block. Shown under the rule for ledger item `services.list`.
 * Titles and descriptions are CDA's own, from the cdaheating.com homepage.
 */
export const services: { title: string; blurb: string; intent: "heating_service" | "replacement_estimate" | "other" }[] = [
  { title: "Furnace Repair", blurb: "Diagnose no-heat calls, ignition faults, airflow problems, and winter safety issues.", intent: "heating_service" },
  { title: "Heat Pump Service", blurb: "Inspect heating and cooling performance, controls, and defrost-related issues.", intent: "heating_service" },
  { title: "Ductless Mini-Splits", blurb: "Troubleshoot room-by-room comfort issues, controls, and refrigerant performance.", intent: "heating_service" },
  { title: "Maintenance and Tune-Ups", blurb: "Catch worn components early and reduce the chance of seasonal breakdowns.", intent: "other" },
  { title: "Thermostat Service", blurb: "Test the control path so you know whether the issue is the thermostat or the equipment.", intent: "other" },
  { title: "AC Repair", blurb: "Solve weak cooling, frozen coils, airflow problems, and moisture issues without guesswork.", intent: "other" },
];
