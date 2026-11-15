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
    value: "Not stated on CDA's site",
    source: `cdaheating.com says “we follow up as soon as we can during business hours” without giving the hours; its page data lists the phone line as open around the clock. One third-party directory shows Monday–Friday, 8am–5pm. ${OWN_SITE}`,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Ask CDA for their office hours if they want them on the page. Kept off the page until then.",
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
    value: "20+ years of HVAC experience",
    source: `cdaheating.com credits co-owner Eddie Proulx with 20+ years of HVAC experience — the figure is his time in the trade, not the company's age (a directory profile says the company started in 2022). ${OWN_SITE}`,
    checkedOn: RESEARCH_DATE,
    audience: "public",
    toVerify: "Confirm the figure and the wording with CDA.",
  },
  {
    id: "business.ownership",
    class: "reported",
    label: "Ownership",
    value: "Owner-operated by long-time Coeur d’Alene residents; co-owner Eddie Proulx is named on the site. A MapQuest profile adds co-owner Dale Thomas and a 2022 start.",
    source: `cdaheating.com homepage, plus a MapQuest directory profile. ${OWN_SITE}`,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Confirm with CDA before naming anyone on a public page.",
  },
  {
    id: "claim.local",
    class: "reported",
    label: "Local ownership",
    value: "Locally owned and owner-operated",
    source: `cdaheating.com homepage. ${OWN_SITE}`,
    checkedOn: RESEARCH_DATE,
    audience: "public",
    toVerify: "Confirm the wording with CDA.",
  },
  {
    id: "claim.positioning",
    class: "reported",
    label: "How CDA describes itself",
    value: "Clear diagnostics, respectful in-home service and dependable repair work.",
    source: `cdaheating.com homepage. ${OWN_SITE}`,
    checkedOn: RESEARCH_DATE,
    audience: "public",
    toVerify: "CDA's own line, lightly trimmed. Confirm they are happy to have it on this page.",
  },
  {
    id: "contact.email",
    class: "reported",
    label: "Contact email on CDA's site",
    value: "eddiep@cdaheating.net",
    source: `cdaheating.com contact page and page data. One snippet showed it obscured, so the spelling needs checking. ${OWN_SITE}`,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Not shown on the funnel. Ask CDA whether this is where new-lead alerts should go (LEAD_NOTIFY_EMAIL_TO).",
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
    value: "$220 diagnostic at the start of every visit, covering a safety-first evaluation and an explanation of what was found, the likely repair paths and the next step before any work begins",
    source: `Stated on cdaheating.com's Spokane Valley, Liberty Lake and Post Falls pages. ${OWN_SITE}`,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "The dollar figure is kept off the funnel on purpose — the page states no prices. If CDA wants it shown, confirm the current figure and wording first.",
  },
  {
    id: "services.list",
    class: "reported",
    label: "Services",
    value: "Furnace repair, AC repair, heat pumps, ductless mini-splits, maintenance and tune-ups, thermostats",
    source: `Each has its own page on cdaheating.com; the one-line descriptions on the funnel (\`services\` at the bottom of this file) are condensed from those pages. Indoor air quality and ductwork are mentioned as related work. No page for furnace or system replacement was found. ${OWN_SITE}`,
    checkedOn: RESEARCH_DATE,
    audience: "public",
    toVerify: "Confirm the list with CDA, and that they want replacement-estimate requests even though their own site has no page for it.",
  },
  {
    id: "claim.repairOrReplace",
    class: "reported",
    label: "Repair or replace",
    value: "Many furnaces can be repaired cost-effectively. If replacement makes more sense given the age, condition or repair cost, CDA says so clearly, without pressure either way.",
    source: `cdaheating.com furnace-repair pages. Used in the “repair or replacement” answer under Common questions. ${OWN_SITE}`,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Covered by the copy sign-off.",
  },
  {
    id: "claim.safetyFirst",
    class: "reported",
    label: "How a visit starts",
    value: "Every visit starts with a safety-first diagnostic (for furnaces: combustion, venting and heat exchanger first). The tech explains what was found, the repair options and the next step before any work begins.",
    source: `cdaheating.com Post Falls and Liberty Lake pages. Used in “How it works” step 3, without the fee. ${OWN_SITE}`,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Covered by the copy sign-off.",
  },

  // ───────────────────────── AI-generated summaries ─────────────────────────
  {
    id: "ai.webPresence",
    class: "ai_summary",
    label: "Summary of CDA's public web presence",
    value:
      "CDA Heating & Cooling appears in Apple Maps, Yelp, MapQuest, Yahoo Local and BuildZoom at a Hauser, Idaho address, with (208) 916-1956 as the phone number everywhere, including on its own site. cdaheating.com describes a locally owned, owner-operated company serving Spokane County and North Idaho, with a page per town and per repair service, 24/7 emergency service and a $220 safety-first diagnostic at the start of each visit. It credits co-owner Eddie Proulx with 20+ years in the trade, lists a contact email, and has a request form of its own. Nothing on the site or elsewhere mentions financing, Payzer or WEX, a maintenance plan's terms, or a sizeable review count; the “What homeowners say” section showed no review text, and the site has no replacement page.",
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
    value: "Coeur d’Alene, Post Falls, Hayden, Rathdrum, Liberty Lake, Spokane Valley, Spokane, Mead, Cheney",
    source: `Each of these towns has its own service page on cdaheating.com, which describes the service area as Spokane County plus Kootenai, Bonner and Shoshone counties (it also has pages for Ponderay, Kootenai, Priest River, Clark Fork and Wallace, left off the form because they fall outside this funnel's target area). The form never tells anyone “we serve your town” — it only asks where the home is. Edit \`towns\` at the bottom of content/site.ts. ${OWN_SITE}`,
    checkedOn: RESEARCH_DATE,
    audience: "internal",
    toVerify: "Ask CDA whether they want every one of these towns offered, and whether any should be added.",
  },
  {
    id: "process.callback",
    class: "assumption",
    label: "What happens after a request",
    value: "CDA's office is notified of each request and someone calls or texts the person back.",
    source: "Assumed workflow. The page says CDA follows up “as soon as we can during business hours” — the same wording as CDA's own contact page — and promises no time frame.",
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
    source: "Drafted for this build; it says the same thing as the line on CDA's own contact form (“By submitting, you agree to receive calls and texts about the request”). Not reviewed by a lawyer.",
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
    successBody: "CDA has your details and will follow up by call or text as soon as we can during business hours. If the house is getting cold, don’t wait on us — call.",
  },
  steps: [
    { title: "Tell us what’s happening", body: "Two short steps. No account, no long form." },
    { title: "We follow up", body: "CDA calls or texts as soon as we can during business hours to talk it through and set a time." },
    { title: "A tech comes to the house", body: "Every visit starts with a safety-first diagnostic. You hear what we found, your options and the next step before any work begins." },
  ],
  services: { title: "What we work on" },
  beforeAfter: { title: "Old unit out. New unit in.", hint: "Drag to compare" },
  gallery: { title: "Our crew, on real jobs" },
  faq: [
    { q: "What happens after I send a request?", a: "Your details go straight to CDA. We follow up by call or text as soon as we can during business hours to ask a few questions and set a time." },
    { q: "My heat is out right now. Should I still use the form?", a: "Call instead. The form is there if you can’t talk right now, but a call reaches us fastest." },
    { q: "Is there any cost to request an estimate?", a: "Sending a request costs nothing. Ask about visit and estimate details when we call you back." },
    { q: "I’m not sure if I need a repair or a replacement.", a: "That’s common. Pick “Heating service” and tell us what you’re seeing. Many furnaces can be repaired cost-effectively. If replacement makes more sense given the age, condition or repair cost, we’ll tell you that clearly, without pressure either way." },
  ],
  privacy: "We use what you send only to respond to your request. This page remembers which link or ad brought you here so CDA knows what’s working; it sets no advertising cookies.",
};

export const towns = ["Coeur d’Alene", "Post Falls", "Hayden", "Rathdrum", "Liberty Lake", "Spokane Valley", "Spokane", "Mead", "Cheney"];

/**
 * The services block. Shown under the rule for ledger item `services.list`:
 * tagged "unverified" in preview, hidden in live until that item is verified.
 * Descriptions are condensed from the matching pages on cdaheating.com.
 */
export const services: { title: string; blurb: string; intent: "heating_service" | "replacement_estimate" | "other" }[] = [
  { title: "Furnace repair", blurb: "No heat, short cycling or a safety shutoff. Combustion, venting and the heat exchanger are checked first.", intent: "heating_service" },
  { title: "Heat pumps", blurb: "Heating and cooling performance, controls and defrost problems.", intent: "heating_service" },
  { title: "Ductless mini-splits", blurb: "Room-by-room comfort issues, controls and refrigerant performance.", intent: "heating_service" },
  { title: "Maintenance and tune-ups", blurb: "Filters and airflow, coils and the blower, checked for buildup and wear.", intent: "other" },
  { title: "Thermostats", blurb: "Service, replacement and upgrades.", intent: "other" },
  { title: "AC repair", blurb: "Diagnostics, refrigerant and leak checks, and electrical testing.", intent: "other" },
];
