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
const WEB_SEARCH = "Web search results read on 2026-11-15. CDA's own website could not be opened from the build environment, so this was not checked against it.";
const OWN_SITE = "CDA's own website (cdaheating.com), as read through a search engine on 2026-11-15 — the pages themselves could not be opened from the build environment, and nobody at CDA has confirmed it.";

export const ledger: LedgerItem[] = [
  // ───────────────────────── Verified ─────────────────────────
  {
    id: "business.name",
    class: "verified",
    label: "Business name",
    value: "CDA Heating & Cooling",
    source: "Project brief from Cost2shoot. Public listings use both “&” and “and”.",
    checkedOn: RESEARCH_DATE,
    verifiedBy: "Cost2shoot (project brief)",
    verifiedOn: RESEARCH_DATE,
    audience: "public",
  },
  {
    id: "funnel.targetArea",
    class: "verified",
    label: "Area this funnel targets",
    value: "Coeur d’Alene, Spokane Valley and Spokane County",
    source: "Project brief from Cost2shoot. This is the campaign target, not a statement of every town CDA will drive to.",
    checkedOn: RESEARCH_DATE,
    verifiedBy: "Cost2shoot (project brief)",
    verifiedOn: RESEARCH_DATE,
    audience: "public",
  },
  {
    id: "scope.webSeparate",
    class: "verified",
    label: "Scope",
    value: "Web development (this funnel and its admin) is a separate workstream from the existing $2,500/month social-management scope.",
    source: "Project brief from Cost2shoot. No price for the web work is recorded here.",
    checkedOn: RESEARCH_DATE,
    verifiedBy: "Cost2shoot (project brief)",
    verifiedOn: RESEARCH_DATE,
    audience: "internal",
  },

  // ───────────────────────── Reported (not yet verified) ─────────────────────────
  {
    id: "business.phone",
    class: "reported",
    label: "Phone number",
    value: "(208) 916-1956",
    source: `Shown on cdaheating.com's homepage, town pages and repair pages, and in Yelp, MapQuest and Apple Maps listings. ${OWN_SITE}`,
    checkedOn: RESEARCH_DATE,
    audience: "public",
    requiredForLaunch: true,
    toVerify: "Open cdaheating.com and check the number, then confirm with CDA that the funnel should ring it (and not a separate tracking number).",
  },
  {
    id: "business.address",
    class: "reported",
    label: "Address",
    value: "16436 W Prairie Ave, Hauser, ID 83854",
    source: `Yelp and MapQuest listing titles. ${WEB_SEARCH}`,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Confirm with CDA, and whether they want an address shown at all.",
  },
  {
    id: "business.hours",
    class: "reported",
    label: "Office hours",
    value: "Monday–Friday, 8am–5pm",
    source: `A third-party directory listing. ${WEB_SEARCH}`,
    checkedOn: RESEARCH_DATE,
    audience: "public",
    toVerify: "Confirm with CDA. Conflicts with the “24/7” line below unless that is after-hours emergency service.",
  },
  {
    id: "claim.emergency",
    class: "reported",
    label: "After-hours / emergency service",
    value: "24/7 emergency service",
    source: `Stated on cdaheating.com's homepage and its Post Falls furnace-repair page. ${OWN_SITE}`,
    checkedOn: RESEARCH_DATE,
    audience: "public",
    toVerify: "Confirm with CDA whether they really answer and dispatch around the clock, and which number to call.",
  },
  {
    id: "claim.licensed",
    class: "reported",
    label: "Licensing",
    value: "Licensed, bonded and insured in Idaho and Washington",
    source: `Stated on a cdaheating.com town page; BuildZoom lists a Kootenai County contractor licence at the Hauser address. No state licence number was found. ${OWN_SITE}`,
    checkedOn: RESEARCH_DATE,
    audience: "public",
    toVerify: "Get the Idaho and Washington licence numbers from CDA and check them against the state lookups before showing this.",
  },
  {
    id: "claim.experience",
    class: "reported",
    label: "Experience",
    value: "20+ years of experience",
    source: `CDA's own pages as summarised in search results. A directory profile says the company was started in 2022, so this is likely personal trade experience, not company age. ${WEB_SEARCH}`,
    checkedOn: RESEARCH_DATE,
    audience: "public",
    toVerify: "Ask CDA exactly what the number refers to and how they want it worded.",
  },
  {
    id: "business.ownership",
    class: "reported",
    label: "Ownership",
    value: "Started in 2022 by co-owners Eddie Proulx and Dale Thomas",
    source: `A MapQuest directory profile. CDA's own pages say “owner-operated” without names — the sources do not fully agree. ${WEB_SEARCH}`,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Confirm with CDA before naming anyone on a public page.",
  },
  {
    id: "reviews.yelp",
    class: "reported",
    label: "Yelp rating",
    value: "5.0 stars from 3 reviews",
    source: `Yelp listing “CDA Heating and Cooling”, Hauser. ${WEB_SEARCH}`,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Too small a sample to advertise. Get CDA's Google Business Profile rating and count, and their permission to quote reviewers.",
  },
  {
    id: "business.website",
    class: "reported",
    label: "Existing website",
    value: "https://www.cdaheating.com/",
    source: `cdaheating.com is the site search engines index, with a page per town and per service. cdaheating.net appears only as the domain of CDA's contact email, and a pages.dev address holds what looks like a build copy of the same site. ${OWN_SITE}`,
    checkedOn: RESEARCH_DATE,
    audience: "public",
    toVerify: "Confirm with CDA that cdaheating.com is the address to link to. The funnel links to it in the footer once verified; it does not replace it.",
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

  {
    id: "price.diagnostic",
    class: "reported",
    label: "Diagnostic fee",
    value: "$220 diagnostic at the start of every visit",
    source: `Stated on cdaheating.com's Spokane Valley and Post Falls pages. ${OWN_SITE}`,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Kept off the funnel on purpose — the page states no prices. If CDA wants it shown, confirm the current figure and wording first.",
  },
  {
    id: "services.list",
    class: "reported",
    label: "Services on CDA's site",
    value: "Furnace repair, AC repair, heat pumps, ductless mini-splits, maintenance and tune-ups, thermostats, indoor air quality and ductwork. No page for furnace or system replacement was found.",
    source: OWN_SITE,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Confirm with CDA that they want replacement-estimate requests, since their own site does not have a page for it.",
  },

  // ───────────────────────── AI-generated summaries ─────────────────────────
  {
    id: "ai.webPresence",
    class: "ai_summary",
    label: "Summary of CDA's public web presence",
    value:
      "CDA Heating & Cooling appears in Apple Maps, Yelp, MapQuest, Yahoo Local and BuildZoom at a Hauser, Idaho address, with (208) 916-1956 as the phone number everywhere, including on its own site. cdaheating.com describes a locally owned, owner-operated company serving Spokane County and North Idaho, with a page per town and per repair service, 24/7 emergency service and a $220 diagnostic fee. Nothing on the site or elsewhere mentions financing, Payzer or WEX, a maintenance plan's terms, or a sizeable review count, and the site has no replacement page.",
    source: "Written by an AI assistant from web search result summaries, not from the pages themselves. Treat every detail as a lead to check, not a fact.",
    checkedOn: RESEARCH_DATE,
    audience: "internal",
  },
  {
    id: "ai.pageCopy",
    class: "ai_summary",
    label: "Homepage copy",
    value: "All headlines, button labels, form questions and FAQ answers on the homepage were drafted by an AI assistant. They avoid prices, percentages, equipment ages, guarantees and response-time promises on purpose.",
    source: "content/site.ts → `copy`.",
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    requiredForLaunch: true,
    toVerify: "Cost2shoot and CDA read the page and approve or rewrite the copy.",
  },

  // ───────────────────────── Assumptions ─────────────────────────
  {
    id: "brand.palette",
    class: "assumption",
    label: "Brand colours and logo",
    value: "Placeholder palette (deep lake blue, ember orange, warm paper) and a text wordmark. CDA's real logo and colours are not in this build.",
    source: "CDA's website and brand files could not be reached from the build environment.",
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    requiredForLaunch: true,
    toVerify: "Drop CDA's logo into public/brand/ and set the real colours in `brand` below.",
  },
  {
    id: "photos.source",
    class: "assumption",
    label: "Photos",
    value: "The page has named photo slots and no photos. The “CDA EDIT” folder is on a MacBook this build could not see. No stock or AI images are used in their place.",
    source: "Build environment.",
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    requiredForLaunch: true,
    toVerify: "Run `npm run photos:import -- \"/path/to/CDA EDIT\"`, assign files to slots in `photos` below, and record homeowner permission for anything shot inside a home.",
  },
  {
    id: "area.towns",
    class: "reported",
    label: "Towns offered in the form",
    value: "Coeur d’Alene, Post Falls, Hayden, Rathdrum, Liberty Lake, Spokane Valley, Spokane",
    source: `Each of these towns has its own service page on cdaheating.com, which describes the service area as Spokane County plus Kootenai, Bonner and Shoshone counties (it also has pages for Cheney, Ponderay, Clark Fork and Wallace, left off the form because they fall outside this funnel's target area). The form never tells anyone “we serve your town” — it only asks where the home is. Edit \`towns\` at the bottom of content/site.ts. ${OWN_SITE}`,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Ask CDA whether they want every one of these towns offered, and whether any should be added.",
  },
  {
    id: "process.callback",
    class: "assumption",
    label: "What happens after a request",
    value: "CDA's office is notified of each request and someone calls or texts the person back.",
    source: "Assumed workflow. The page promises a call back but no time frame.",
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
    source: "Drafted for this build. Not reviewed by a lawyer.",
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
    value: "No public link between CDA and Payzer or WEX was found, so the page says nothing about financing. If CDA does use Payzer (now part of WEX), add its application link as a third call to action for replacement estimates.",
    source: `Nothing about financing turned up on cdaheating.com or anywhere else. ${OWN_SITE}`,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Ask CDA whether they offer financing, through whom, and for the customer-facing application link and any required disclosure wording.",
  },
  {
    id: "opp.reviews",
    class: "opportunity",
    label: "Reviews on the page",
    value: "A reviews block is built and switched off. Turn it on with real Google reviews once CDA shares the rating, count and permission to quote.",
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
    value: "Left off the page. Plan perks, frequency and timing are still waiting on CDA (the same open question that blocks Carousel 8).",
    source: "carousel-registry.json in this repository.",
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

/** Brand tokens. Placeholders until CDA's real brand is supplied (see `brand.palette`). */
export const brand = {
  wordmark: "CDA Heating & Cooling",
  /** Path under /public, e.g. "/brand/logo.svg". Empty = text wordmark. */
  logo: "",
  colors: {
    ink: "#14202b",
    paper: "#f7f4ee",
    brand: "#12425f",
    brandDeep: "#0b2c41",
    accent: "#d9480f",
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

/** Homepage copy. AI-drafted — see ledger item `ai.pageCopy`. */
export const copy = {
  metaTitle: "Heating service and replacement estimates — CDA Heating & Cooling",
  metaDescription: "Request heating service or a replacement estimate from CDA Heating & Cooling in Coeur d’Alene, Spokane Valley and Spokane County.",
  hero: {
    eyebrow: "Coeur d’Alene · Spokane Valley · Spokane County",
    headline: "Heat acting up? Tell us what’s going on.",
    sub: "Request heating service or a replacement estimate from CDA Heating & Cooling. Two short steps, then we call you back.",
  },
  cta: { call: "Call CDA", estimate: "Get a replacement estimate", service: "Request heating service" },
  form: {
    title: "Start your request",
    step1: "What do you need?",
    step2: "Where should we reach you?",
    types: [
      { id: "heating_service", title: "Heating service", blurb: "No heat, odd noises, or it can’t keep up." },
      { id: "replacement_estimate", title: "Replacement estimate", blurb: "You’re pricing out a new furnace or heat pump." },
      { id: "other", title: "Something else", blurb: "Cooling, maintenance, or a question." },
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
    successBody: "CDA’s office has your details and will call or text you back. If the house is getting cold, don’t wait on us — call.",
  },
  steps: [
    { title: "Tell us what’s happening", body: "Two short steps. No account, no long form." },
    { title: "We call you back", body: "Someone from CDA’s office reaches out to talk it through and set a time." },
    { title: "A tech comes to the house", body: "For service, we find what’s wrong. For a replacement, we look at the home before we quote." },
  ],
  beforeAfter: { title: "Old unit out. New unit in.", hint: "Drag to compare" },
  gallery: { title: "Our crew, on real jobs" },
  faq: [
    { q: "What happens after I send a request?", a: "Your details go straight to CDA’s office. Someone calls or texts you back to ask a few questions and set a time." },
    { q: "My heat is out right now. Should I still use the form?", a: "Call instead. The form is there if you can’t talk right now, but a call reaches us fastest." },
    { q: "Is there any cost to request an estimate?", a: "Sending a request costs nothing. Ask about visit and estimate details when we call you back." },
    { q: "I’m not sure if I need a repair or a replacement.", a: "That’s common. Pick “Heating service” and tell us what you’re seeing. We’ll talk through the options once a tech has looked at it." },
  ],
  privacy: "We use what you send only to respond to your request. This page remembers which link or ad brought you here so CDA knows what’s working; it sets no advertising cookies.",
};

export const towns = ["Coeur d’Alene", "Post Falls", "Hayden", "Rathdrum", "Liberty Lake", "Spokane Valley", "Spokane"];
