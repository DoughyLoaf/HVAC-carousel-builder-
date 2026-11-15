import { describe, expect, it } from "vitest";
import { classifyLead, classifyTouch, hasSignal, sanitizeTouch, touchFromUrl, trackedUrl } from "@/lib/attribution";
import { touch } from "./helpers";

describe("touchFromUrl", () => {
  it("reads UTM tags, click IDs and the referral code from the landing URL", () => {
    const t = touchFromUrl(
      "https://go.example.com/?utm_source=instagram&utm_medium=reel&utm_campaign=reel-4&utm_content=timelapse&gclid=abc&ref=neighbor-kim",
      "https://l.instagram.com/",
    );
    expect(t).toMatchObject({
      landing_path: "/", utm_source: "instagram", utm_medium: "reel", utm_campaign: "reel-4",
      utm_content: "timelapse", gclid: "abc", ref_code: "neighbor-kim", referrer: "https://l.instagram.com/",
    });
  });

  it("drops a referrer from the site itself", () => {
    expect(touchFromUrl("https://www.example.com/", "https://example.com/other").referrer).toBe("");
  });

  it("survives a URL it cannot parse", () => {
    expect(touchFromUrl("not a url", "").landing_path).toBe("");
  });
});

describe("sanitizeTouch", () => {
  it("drops unknown keys, non-strings and control characters, and caps length", () => {
    const t = sanitizeTouch({ utm_source: "in\u0000sta\ngram", utm_medium: 5, evil: "x", utm_campaign: "a".repeat(400) });
    expect(t.utm_source).toBe("instagram");
    expect(t.utm_medium).toBe("");
    expect(t.utm_campaign).toHaveLength(150);
    expect(Object.keys(t)).not.toContain("evil");
  });
});

describe("classifyTouch", () => {
  const cases: [string, Parameters<typeof touch>[0], string][] = [
    ["Google Ads click ID", { gclid: "x" }, "ad"],
    ["paid medium", { utm_source: "facebook", utm_medium: "paid_social", utm_campaign: "c" }, "ad"],
    ["referral code", { ref_code: "kim" }, "referral"],
    ["referral medium", { utm_medium: "referral", utm_source: "realtor" }, "referral"],
    ["Google Business Profile", { utm_source: "gbp", utm_medium: "organic" }, "review"],
    ["review medium", { utm_source: "google", utm_medium: "review" }, "review"],
    ["email", { utm_source: "newsletter", utm_medium: "email" }, "campaign"],
    ["QR code", { utm_source: "truck", utm_medium: "qr" }, "campaign"],
    ["Instagram carousel", { utm_source: "instagram", utm_medium: "carousel", utm_campaign: "carousel-1" }, "content"],
    ["tagged link with no narrower fit", { utm_campaign: "fall-push" }, "campaign"],
    ["bare fbclid is not assumed to be an ad", { fbclid: "x" }, "content"],
    ["Yelp referrer", { referrer: "https://www.yelp.com/biz/x" }, "review"],
    ["Instagram referrer", { referrer: "https://l.instagram.com/" }, "content"],
    ["Google referrer", { referrer: "https://www.google.com/" }, "search"],
    ["another website", { referrer: "https://somebuilder.example/partners" }, "website"],
    ["nothing at all", {}, "direct"],
  ];
  for (const [name, over, expected] of cases) {
    it(`${name} → ${expected}`, () => {
      const c = classifyTouch(touch(over));
      expect(c.influence).toBe(expected);
      expect(c.basis.length).toBeGreaterThan(5);
    });
  }

  it("an ad click wins over a referral code on the same URL", () => {
    expect(classifyTouch(touch({ gclid: "x", ref_code: "kim" })).influence).toBe("ad");
  });
});

describe("classifyLead", () => {
  it("uses the converting visit when it says anything", () => {
    const c = classifyLead(touch({ utm_source: "gbp" }), touch({ gclid: "x" }));
    expect(c.influence).toBe("review");
    expect(c.credited).toBe("last");
    expect(c.basis).toMatch(/^Converting visit/);
  });

  it("falls back to the first visit when the converting visit is direct", () => {
    const c = classifyLead(touch(), touch({ utm_source: "instagram", utm_medium: "reel" }));
    expect(c.influence).toBe("content");
    expect(c.credited).toBe("first");
    expect(c.basis).toMatch(/^First visit/);
  });

  it("is direct when neither visit says anything", () => {
    expect(classifyLead(touch(), touch()).influence).toBe("direct");
    expect(classifyLead(touch(), null).influence).toBe("direct");
  });
});

describe("helpers", () => {
  it("hasSignal", () => {
    expect(hasSignal(touch())).toBe(false);
    expect(hasSignal(touch({ utm_campaign: "x" }))).toBe(true);
  });

  it("trackedUrl builds a link that classifies back to the campaign", () => {
    const url = trackedUrl("https://go.example.com", { slug: "carousel-4", utm_source: "instagram", utm_medium: "carousel", utm_content: "slide-7", intent: "heating_service" });
    const t = touchFromUrl(url, "");
    expect(t.utm_campaign).toBe("carousel-4");
    expect(classifyTouch(t).influence).toBe("content");
    expect(new URL(url).searchParams.get("intent")).toBe("heating_service");
  });
});
