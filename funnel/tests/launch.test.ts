import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ledger, photos, type LedgerItem, type PhotoSlot } from "@content/site";
import { launchBlockers, photoUsable, publicFact, siteMode, telHref } from "@/lib/launch";

function publicDirWith(files: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cda-public-"));
  fs.mkdirSync(path.join(dir, "photos"));
  for (const f of files) fs.writeFileSync(path.join(dir, "photos", f), "x");
  return dir;
}

const phone: LedgerItem = {
  id: "business.phone", class: "reported", label: "Phone", value: "(208) 916-1956", source: "s",
  checkedOn: "2026-11-15", audience: "public", requiredForLaunch: true,
};
const heroOk: PhotoSlot = { id: "hero", wanted: "w", file: "hero.jpg", alt: "A tech at a furnace", insideHome: true, permission: "Y" };

describe("launch gate", () => {
  it("a required item that is not verified blocks launch", () => {
    const dir = publicDirWith(["hero.jpg"]);
    expect(launchBlockers([phone], [heroOk], dir).map((b) => b.id)).toEqual(["business.phone"]);
  });

  it("verified needs a name and a date behind it", () => {
    const dir = publicDirWith(["hero.jpg"]);
    expect(launchBlockers([{ ...phone, class: "verified" }], [heroOk], dir)).toHaveLength(1);
    expect(launchBlockers([{ ...phone, class: "verified", verifiedBy: "Erika", verifiedOn: "2026-11-20" }], [heroOk], dir)).toEqual([]);
  });

  it("the hero photo must exist, have alt text, and have permission when shot inside a home", () => {
    const dir = publicDirWith(["hero.jpg"]);
    expect(photoUsable(heroOk, dir)).toBe(true);
    expect(photoUsable({ ...heroOk, permission: "" }, dir)).toBe(false);
    expect(photoUsable({ ...heroOk, permission: "N" }, dir)).toBe(false);
    expect(photoUsable({ ...heroOk, insideHome: false, permission: "" }, dir)).toBe(true);
    expect(photoUsable({ ...heroOk, alt: " " }, dir)).toBe(false);
    expect(photoUsable({ ...heroOk, file: "missing.jpg" }, dir)).toBe(false);
    expect(launchBlockers([], [{ ...heroOk, permission: "" }], dir).map((b) => b.id)).toEqual(["photo.hero"]);
  });

  it("asking for live does not make the site live while anything blocks", () => {
    expect(siteMode({ SITE_MODE: "live" } as never, [{ id: "x", label: "x", why: "y" }])).toBe("preview");
    expect(siteMode({ SITE_MODE: "live" } as never, [])).toBe("live");
    expect(siteMode({} as never, [])).toBe("preview");
  });

  it("the shipped content is honestly in preview", () => {
    const ids = launchBlockers().map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(["business.phone", "brand.palette", "photos.source", "photo.hero", "ai.pageCopy"]));
    expect(siteMode({ SITE_MODE: "live" } as never)).toBe("preview");
  });
});

describe("publicFact", () => {
  const items: LedgerItem[] = [
    phone,
    { ...phone, id: "v", class: "verified", verifiedBy: "E", verifiedOn: "2026-11-20" },
    { ...phone, id: "internal", audience: "internal" },
    { ...phone, id: "idea", class: "opportunity" },
  ];
  it("live shows verified facts only", () => {
    expect(publicFact("business.phone", "live", items)).toBeNull();
    expect(publicFact("v", "live", items)).toEqual({ value: "(208) 916-1956", unverified: false });
  });
  it("preview shows unverified facts, marked", () => {
    expect(publicFact("business.phone", "preview", items)).toEqual({ value: "(208) 916-1956", unverified: true });
  });
  it("internal items and ideas never reach the page", () => {
    expect(publicFact("internal", "preview", items)).toBeNull();
    expect(publicFact("idea", "preview", items)).toBeNull();
    expect(publicFact("nope", "preview", items)).toBeNull();
  });
});

describe("content/site.ts", () => {
  it("every ledger item has an id, a source and a check date; ids are unique", () => {
    const ids = new Set<string>();
    for (const i of ledger) {
      expect(i.source.length, i.id).toBeGreaterThan(5);
      expect(i.checkedOn, i.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ids.has(i.id), i.id).toBe(false);
      ids.add(i.id);
    }
  });
  it("nothing about financing, reviews or ownership is public", () => {
    for (const id of ["financing.payzer", "reviews.yelp", "business.ownership"]) {
      expect(ledger.find((i) => i.id === id)?.audience).toBe("internal");
    }
  });
  it("photo slots have unique ids", () => {
    expect(new Set(photos.map((p) => p.id)).size).toBe(photos.length);
  });
  it("telHref", () => {
    expect(telHref("(208) 916-1956")).toBe("+12089161956");
    expect(telHref("call us")).toBe("");
  });
});
