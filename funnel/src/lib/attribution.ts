/**
 * Attribution: what a visit carried with it, and what kind of thing most likely
 * sent the person. Pure functions — used in the browser (capture), on the server
 * (re-derive, never trust the client's conclusion) and in tests.
 */

export type Influence =
  | "ad"
  | "content"
  | "referral"
  | "review"
  | "campaign"
  | "search"
  | "website"
  | "direct";

export const INFLUENCE_LABEL: Record<Influence, string> = {
  ad: "Paid ad",
  content: "Social content",
  referral: "Referral",
  review: "Review / listing",
  campaign: "Campaign (email, text, print, QR)",
  search: "Unpaid search",
  website: "Link from another website",
  direct: "Direct / unknown",
};

export const INFLUENCES = Object.keys(INFLUENCE_LABEL) as Influence[];

/** One visit's attribution data. Every field is a plain, length-capped string. */
export interface Touch {
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
  /** ISO time the visit was seen, set in the browser. */
  at: string;
}

export const EMPTY_TOUCH: Touch = {
  landing_path: "",
  referrer: "",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_content: "",
  utm_term: "",
  gclid: "",
  fbclid: "",
  msclkid: "",
  ref_code: "",
  at: "",
};

const TOUCH_KEYS = Object.keys(EMPTY_TOUCH) as (keyof Touch)[];
const MAX_LEN: Partial<Record<keyof Touch, number>> = { referrer: 500, landing_path: 300 };

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  // Control characters never belong in a tracking value.
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

/** Coerces anything (client JSON, form data) into a safe Touch. Unknown keys are dropped. */
export function sanitizeTouch(input: unknown): Touch {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out = { ...EMPTY_TOUCH };
  for (const key of TOUCH_KEYS) out[key] = clean(src[key], MAX_LEN[key] ?? 150);
  return out;
}

/** Reads a Touch from a landing URL and the document referrer. */
export function touchFromUrl(href: string, referrer: string, now = new Date()): Touch {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { ...EMPTY_TOUCH, at: now.toISOString() };
  }
  const q = url.searchParams;
  return sanitizeTouch({
    landing_path: url.pathname,
    referrer: sameHost(referrer, url.hostname) ? "" : referrer,
    utm_source: q.get("utm_source") ?? "",
    utm_medium: q.get("utm_medium") ?? "",
    utm_campaign: q.get("utm_campaign") ?? "",
    utm_content: q.get("utm_content") ?? "",
    utm_term: q.get("utm_term") ?? "",
    gclid: q.get("gclid") ?? "",
    fbclid: q.get("fbclid") ?? "",
    msclkid: q.get("msclkid") ?? "",
    ref_code: q.get("ref") ?? "",
    at: now.toISOString(),
  });
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sameHost(referrer: string, hostname: string): boolean {
  const ref = hostOf(referrer);
  return ref !== "" && ref === hostname.toLowerCase().replace(/^www\./, "");
}

/** True when the visit carries anything beyond "someone opened the page". */
export function hasSignal(t: Touch): boolean {
  return Boolean(
    t.utm_source || t.utm_medium || t.utm_campaign || t.utm_content || t.gclid || t.fbclid || t.msclkid ||
      t.ref_code || t.referrer,
  );
}

const PAID_MEDIA = new Set(["cpc", "ppc", "paid", "paidsocial", "paid-social", "paid_social", "ads", "ad", "display", "cpm", "lsa"]);
const SOCIAL_MEDIA = new Set(["social", "organic-social", "organic_social", "reel", "reels", "carousel", "post", "story", "stories", "bio", "video"]);
const SOCIAL_SOURCES = new Set(["instagram", "ig", "facebook", "fb", "meta", "tiktok", "youtube", "threads", "linkedin", "pinterest"]);
const REVIEW_SOURCES = new Set(["gbp", "gmb", "google-business-profile", "google_business_profile", "googlebusiness", "google-reviews", "google_reviews", "yelp", "nextdoor", "angi", "bbb", "homeadvisor", "thumbtack"]);
const REVIEW_MEDIA = new Set(["review", "reviews", "listing", "directory", "gbp"]);
const CAMPAIGN_MEDIA = new Set(["email", "sms", "text", "mail", "mailer", "postcard", "print", "qr", "flyer", "doorhanger", "door-hanger", "truck", "yard-sign", "radio"]);
const REFERRAL_MEDIA = new Set(["referral", "refer", "partner", "word-of-mouth", "wom"]);

const SEARCH_HOSTS = /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|yahoo\.com|ecosia\.org|brave\.com|startpage\.com)$/;
const SOCIAL_HOSTS = /(^|\.)(instagram\.com|facebook\.com|fb\.com|fb\.me|tiktok\.com|youtube\.com|youtu\.be|threads\.net|threads\.com|linkedin\.com|lnkd\.in|pinterest\.com|t\.co|x\.com|twitter\.com)$/;
const REVIEW_HOSTS = /(^|\.)(yelp\.com|nextdoor\.com|angi\.com|bbb\.org|homeadvisor\.com|thumbtack\.com|business\.google\.com|g\.page)$/;

export interface Classification {
  influence: Influence;
  /** Plain-language reason, shown in the admin so nobody has to trust a black box. */
  basis: string;
}

/** Classifies one visit. The first rule that matches wins, in the order written. */
export function classifyTouch(t: Touch): Classification {
  const source = t.utm_source.toLowerCase();
  const medium = t.utm_medium.toLowerCase();
  const refHost = hostOf(t.referrer);

  if (t.gclid) return { influence: "ad", basis: "Google Ads click ID (gclid) on the landing URL" };
  if (t.msclkid) return { influence: "ad", basis: "Microsoft Ads click ID (msclkid) on the landing URL" };
  if (PAID_MEDIA.has(medium)) return { influence: "ad", basis: `utm_medium=${t.utm_medium}` };

  if (t.ref_code) return { influence: "referral", basis: `Referral code ref=${t.ref_code}` };
  if (REFERRAL_MEDIA.has(medium) || source === "referral") {
    return { influence: "referral", basis: `utm_medium=${t.utm_medium || "—"}, utm_source=${t.utm_source || "—"}` };
  }

  if (REVIEW_SOURCES.has(source) || REVIEW_MEDIA.has(medium)) {
    return { influence: "review", basis: `utm_source=${t.utm_source || "—"}, utm_medium=${t.utm_medium || "—"}` };
  }

  if (CAMPAIGN_MEDIA.has(medium)) return { influence: "campaign", basis: `utm_medium=${t.utm_medium}` };

  if (SOCIAL_MEDIA.has(medium) || SOCIAL_SOURCES.has(source)) {
    return { influence: "content", basis: `utm_source=${t.utm_source || "—"}, utm_medium=${t.utm_medium || "—"}` };
  }

  if (t.utm_campaign || t.utm_source || t.utm_medium) {
    return { influence: "campaign", basis: "Tagged link (UTM values present) that fits no narrower rule" };
  }

  // A bare fbclid says the click came through Facebook or Instagram, but not
  // whether it was a paid ad or an unpaid post — so it is not counted as an ad.
  if (t.fbclid) return { influence: "content", basis: "Meta click ID (fbclid) without UTM tags — paid or unpaid is unknown" };

  if (refHost) {
    if (REVIEW_HOSTS.test(refHost)) return { influence: "review", basis: `Referrer ${refHost}` };
    if (SOCIAL_HOSTS.test(refHost)) return { influence: "content", basis: `Referrer ${refHost}` };
    if (SEARCH_HOSTS.test(refHost)) return { influence: "search", basis: `Referrer ${refHost}` };
    return { influence: "website", basis: `Referrer ${refHost}` };
  }

  return { influence: "direct", basis: "No tags, click IDs or referrer on the visit" };
}

export interface LeadClassification extends Classification {
  /** Which visit decided it — and therefore whose campaign, content and landing page get the credit. */
  credited: "last" | "first";
}

/**
 * The conclusion for a lead. The visit that sent the form decides; when that
 * visit says nothing ("direct"), the first visit seen from the same browser does.
 */
export function classifyLead(last: Touch, first: Touch | null): LeadClassification {
  const lastC = classifyTouch(last);
  if (lastC.influence !== "direct" || !first) return { ...lastC, basis: `Converting visit: ${lastC.basis}`, credited: "last" };
  const firstC = classifyTouch(first);
  if (firstC.influence === "direct") return { ...lastC, basis: `Converting visit: ${lastC.basis}`, credited: "last" };
  return { influence: firstC.influence, basis: `First visit (the converting visit was direct): ${firstC.basis}`, credited: "first" };
}

/** Builds a tagged landing URL for a campaign. */
export function trackedUrl(
  base: string,
  c: { slug: string; utm_source: string; utm_medium: string; utm_content: string; intent: string },
): string {
  const url = new URL("/", base);
  if (c.utm_source) url.searchParams.set("utm_source", c.utm_source);
  if (c.utm_medium) url.searchParams.set("utm_medium", c.utm_medium);
  url.searchParams.set("utm_campaign", c.slug);
  if (c.utm_content) url.searchParams.set("utm_content", c.utm_content);
  if (c.intent) url.searchParams.set("intent", c.intent);
  return url.toString();
}
