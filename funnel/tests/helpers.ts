import path from "node:path";
import { migrate, openPglite, type Db } from "@/lib/db";
import { EMPTY_TOUCH, type Touch } from "@/lib/attribution";
import type { LeadInput } from "@/lib/validate";

/** A fresh in-memory Postgres with the real migrations applied. */
export async function freshDb(): Promise<Db> {
  const db = await openPglite();
  await migrate(db, path.join(import.meta.dirname, "..", "db", "migrations"));
  return db;
}

export function touch(over: Partial<Touch> = {}): Touch {
  return { ...EMPTY_TOUCH, landing_path: "/", at: "2026-11-15T18:00:00.000Z", ...over };
}

export function leadInput(over: Partial<LeadInput> = {}): LeadInput {
  return {
    request_type: "heating_service",
    urgency: "soon",
    town: "Post Falls",
    zip: "83854",
    message: "",
    name: "Test Person",
    phone: "(208) 555-0142",
    email: "",
    preferred_contact: "either",
    consent_text: "consent wording",
    self_reported_source: "",
    last_touch: touch(),
    first_touch: null,
    ...over,
  };
}
