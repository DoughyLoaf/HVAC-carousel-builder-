import { describe, expect, it } from "vitest";
import { formatDollars, isDate, normalizePhone, parseDollars, parseLead, slugify } from "@/lib/validate";

describe("normalizePhone", () => {
  it("accepts common ways of typing a US number", () => {
    for (const raw of ["2085550142", "208-555-0142", "(208) 555-0142", "+1 208 555 0142", "1.208.555.0142"]) {
      expect(normalizePhone(raw)).toBe("(208) 555-0142");
    }
  });
  it("rejects numbers that cannot be dialled", () => {
    for (const raw of ["", "555-0142", "208555014", "20855501422", "0085550142", "2081550142", "call me"]) {
      expect(normalizePhone(raw)).toBe("");
    }
  });
});

describe("parseLead", () => {
  const good = { request_type: "replacement_estimate", name: "Kim Ortiz", phone: "208 555 0142" };

  it("accepts a minimal request and fills safe defaults", () => {
    const r = parseLead(good);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lead).toMatchObject({ phone: "(208) 555-0142", urgency: "", preferred_contact: "either", first_touch: null });
    expect(r.lead.last_touch.utm_source).toBe("");
  });

  it("reports every problem at once", () => {
    const r = parseLead({ request_type: "free-money", name: "K", phone: "123", email: "nope", zip: "8385" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(["email", "name", "phone", "request_type", "zip"]);
  });

  it("requires a phone on the public form but not for a lead typed in by staff", () => {
    const noPhone = { request_type: "other", name: "Kim Ortiz" };
    expect(parseLead(noPhone).ok).toBe(false);
    expect(parseLead(noPhone, { phoneRequired: false }).ok).toBe(true);
  });

  it("ignores values outside the allowed lists and non-object bodies", () => {
    const r = parseLead({ ...good, urgency: "yesterday", preferred_contact: "pigeon" });
    expect(r.ok && r.lead.urgency).toBe("");
    expect(r.ok && r.lead.preferred_contact).toBe("either");
    expect(parseLead(null).ok).toBe(false);
    expect(parseLead("x").ok).toBe(false);
  });

  it("caps a long message", () => {
    const r = parseLead({ ...good, message: "x".repeat(5000) });
    expect(r.ok && r.lead.message.length).toBe(2000);
  });
});

describe("money, dates and slugs", () => {
  it("parseDollars", () => {
    expect(parseDollars("")).toBeNull();
    expect(parseDollars("$4,250")).toBe(425000);
    expect(parseDollars("189.5")).toBe(18950);
    expect(parseDollars("12.345")).toBeNaN();
    expect(parseDollars("-5")).toBeNaN();
    expect(parseDollars("lots")).toBeNaN();
  });
  it("formatDollars", () => {
    expect(formatDollars(425000)).toBe("$4,250");
    expect(formatDollars(18950)).toBe("$189.50");
    expect(formatDollars(null)).toBe("—");
  });
  it("isDate", () => {
    expect(isDate("2026-11-15")).toBe(true);
    expect(isDate("2026-13-40")).toBe(false);
    expect(isDate("11/15/2026")).toBe(false);
  });
  it("slugify", () => {
    expect(slugify("Carousel 4 — No Heat? (IG)")).toBe("carousel-4-no-heat-ig");
  });
});
