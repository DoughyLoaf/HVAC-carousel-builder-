import { sanitizeTouch, type Touch } from "./attribution";

export const REQUEST_TYPES = ["replacement_estimate", "heating_service", "other"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];
export const REQUEST_LABEL: Record<RequestType, string> = {
  replacement_estimate: "Replacement estimate",
  heating_service: "Heating service",
  other: "Something else",
};

export const URGENCIES = ["", "urgent", "soon", "planning"] as const;
export type Urgency = (typeof URGENCIES)[number];
export const URGENCY_LABEL: Record<Urgency, string> = {
  "": "Not given",
  urgent: "No heat right now",
  soon: "This week",
  planning: "Just planning",
};

export const CONTACT_PREFS = ["call", "text", "either"] as const;
export type ContactPref = (typeof CONTACT_PREFS)[number];

export interface LeadInput {
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
  self_reported_source: string;
  last_touch: Touch;
  first_touch: Touch | null;
}

export type FieldErrors = Partial<Record<"request_type" | "name" | "phone" | "email" | "zip" | "form", string>>;

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max) : "";
}

/** Formats a US phone number as (208) 555-0100. Returns "" when it is not one. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (digits.length !== 10) return "";
  // Area codes and exchanges never start with 0 or 1.
  if (/^[01]/.test(digits) || /^[01]/.test(digits.slice(3))) return "";
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function validEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw) && raw.length <= 200;
}

export type Parsed = { ok: true; lead: LeadInput } | { ok: false; errors: FieldErrors };

/** Validates a lead from the public form or the admin "add lead" form. */
export function parseLead(body: unknown, opts: { phoneRequired: boolean } = { phoneRequired: true }): Parsed {
  const src = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const errors: FieldErrors = {};

  const request_type = text(src.request_type, 40) as RequestType;
  if (!REQUEST_TYPES.includes(request_type)) errors.request_type = "Choose what you need.";

  const urgencyRaw = text(src.urgency, 20) as Urgency;
  const urgency = URGENCIES.includes(urgencyRaw) ? urgencyRaw : "";

  const name = text(src.name, 120);
  if (name.length < 2) errors.name = "Tell us your name.";

  const phoneRaw = text(src.phone, 40);
  const phone = normalizePhone(phoneRaw);
  if (phoneRaw && !phone) errors.phone = "That doesn’t look like a 10-digit phone number.";
  else if (!phoneRaw && opts.phoneRequired) errors.phone = "We need a phone number to call or text you back.";

  const email = text(src.email, 200).toLowerCase();
  if (email && !validEmail(email)) errors.email = "Check the email address, or leave it blank.";

  const zip = text(src.zip, 10);
  if (zip && !/^\d{5}$/.test(zip)) errors.zip = "ZIP codes are 5 digits.";

  const prefRaw = text(src.preferred_contact, 10) as ContactPref;
  const preferred_contact = CONTACT_PREFS.includes(prefRaw) ? prefRaw : "either";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const firstRaw = src.first_touch;
  return {
    ok: true,
    lead: {
      request_type,
      urgency,
      town: text(src.town, 80),
      zip,
      message: text(src.message, 2000),
      name,
      phone,
      email,
      preferred_contact,
      consent_text: text(src.consent_text, 400),
      self_reported_source: text(src.self_reported_source, 80),
      last_touch: sanitizeTouch(src.last_touch),
      first_touch: firstRaw && typeof firstRaw === "object" ? sanitizeTouch(firstRaw) : null,
    },
  };
}

/** Dollars typed by a person ("4,250", "$4250.50") → cents. Null when blank; NaN when not a number. */
export function parseDollars(raw: string): number | null {
  const t = raw.replace(/[$,\s]/g, "");
  if (t === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return Number.NaN;
  const cents = Math.round(Number(t) * 100);
  return cents > 2_000_000_000 ? Number.NaN : cents;
}

export function formatDollars(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 });
}

export function isDate(raw: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(`${raw}T00:00:00Z`));
}

export function slugify(raw: string): string {
  return raw.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
