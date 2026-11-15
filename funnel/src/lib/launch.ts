import fs from "node:fs";
import path from "node:path";
import { ledger, photos, type LedgerItem, type PhotoSlot } from "@content/site";

export type SiteMode = "preview" | "live";

export interface Blocker {
  id: string;
  label: string;
  why: string;
}

export function item(id: string, items: LedgerItem[] = ledger): LedgerItem | undefined {
  return items.find((i) => i.id === id);
}

/** A slot's photo can be shown when the file exists and, for inside-home shots, permission is "Y". */
export function photoUsable(slot: PhotoSlot, publicDir = path.join(process.cwd(), "public")): boolean {
  if (!slot.file || !slot.alt.trim()) return false;
  if (slot.insideHome && slot.permission !== "Y") return false;
  return fs.existsSync(path.join(publicDir, "photos", path.basename(slot.file)));
}

/** Everything that keeps the site in preview. Empty list = clear to go live. */
export function launchBlockers(
  items: LedgerItem[] = ledger,
  slots: PhotoSlot[] = photos,
  publicDir?: string,
): Blocker[] {
  const out: Blocker[] = items
    .filter((i) => i.requiredForLaunch && i.class !== "verified")
    .map((i) => ({ id: i.id, label: i.label, why: i.toVerify ?? "Not verified yet." }));
  for (const i of items) {
    if (i.class === "verified" && !(i.verifiedBy?.trim() && i.verifiedOn?.trim())) {
      out.push({ id: i.id, label: i.label, why: "Marked verified without saying who verified it and when." });
    }
  }
  const hero = slots.find((s) => s.id === "hero");
  if (!hero || !photoUsable(hero, publicDir)) {
    out.push({
      id: "photo.hero",
      label: "Hero photo",
      why: "The hero slot needs a real CDA photo: a file in public/photos/, alt text, and homeowner permission if it was shot inside a home.",
    });
  }
  return out;
}

/**
 * The mode the site actually runs in. Asking for "live" is not enough: while
 * any blocker remains, the site stays in preview (ribbon on, search engines off).
 */
export function siteMode(env: NodeJS.ProcessEnv = process.env, blockers = launchBlockers()): SiteMode {
  return env.SITE_MODE === "live" && blockers.length === 0 ? "live" : "preview";
}

export interface PublicFact {
  value: string;
  /** True when the value is shown only because the site is in preview. */
  unverified: boolean;
}

/** A public fact for the page: its value when verified, a marked value in preview, nothing in live. */
export function publicFact(id: string, mode: SiteMode, items: LedgerItem[] = ledger): PublicFact | null {
  const it = item(id, items);
  if (!it || it.audience !== "public") return null;
  if (it.class === "verified") return { value: it.value, unverified: false };
  if (mode === "preview" && (it.class === "reported" || it.class === "assumption")) {
    return { value: it.value, unverified: true };
  }
  return null;
}

/** "(208) 916-1956" → "+12089161956". Returns "" when it is not a 10-digit US number. */
export function telHref(display: string): string {
  const digits = display.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return digits.length === 10 ? `+1${digits}` : "";
}
