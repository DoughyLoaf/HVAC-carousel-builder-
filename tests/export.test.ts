import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeRoot, pixel, SHOOT1, solidJpg, useRoot, type FixtureRoot } from "./helpers";

// Each test gets a fresh app root, so modules are re-imported after the
// root directory is set.
let fx: FixtureRoot;

async function app() {
  vi.resetModules();
  useRoot(fx.root);
  return {
    sources: await import("@/lib/sources"),
    exporter: await import("@/lib/exporter"),
    store: await import("@/lib/store"),
    photos: await import("@/lib/photos"),
    service: await import("@/lib/service"),
    markdown: await import("@/lib/markdown"),
  };
}

const readExport = (folder: string, name: string) => fs.readFileSync(path.join(folder, name), "utf8");

beforeEach(() => {
  fx = makeRoot({ withShoot1: true });
});
afterAll(() => fx?.cleanup());
beforeAll(() => undefined);

describe("carousel list", () => {
  it("parses carousels 1, 2, 4, 5, 6, 7 and blocks 3 and 8 with their reasons", async () => {
    const { sources } = await app();
    const all = sources.loadSources();
    expect(all.errors).toEqual([]);
    expect(all.carousels.map((c) => [c.id, c.status])).toEqual([
      [1, "ready"], [2, "ready"], [3, "blocked"], [4, "ready"],
      [5, "ready"], [6, "ready"], [7, "ready"], [8, "blocked"],
    ]);
    expect(all.carousels.map((c) => c.parsed?.slides.length ?? null)).toEqual([6, 7, null, 7, 6, 6, 6, null]);
    expect(all.carousels[2].blocked_reason).toMatch(/commissioning close-ups/);
    expect(all.carousels[7].blocked_reason).toMatch(/Erika.*maintenance plan/);
  });

  it("says which source files are missing instead of inventing carousels", async () => {
    fx.cleanup();
    fx = makeRoot();
    const { sources, exporter } = await app();
    const all = sources.loadSources();
    expect(all.carousels.map((c) => c.status)).toEqual([
      "source_missing", "source_missing", "blocked", "source_missing",
      "source_missing", "source_missing", "source_missing", "blocked",
    ]);
    expect(all.carousels[0].status_reason).toMatch(/cda-hvac-carousels-1-2-build-ready\.md/);
    await expect(exporter.exportCarousel(1)).rejects.toThrow(/Source file not found/);
  });

  it("fails loudly when a file has the wrong number of slides or the wrong title", async () => {
    fx.write("cda-hvac-carousels-1-2-build-ready.md", [{ ...SHOOT1.c1, slides: 5 }, { ...SHOOT1.c2, title: "Some other title" }]);
    const { sources } = await app();
    const all = sources.loadSources();
    expect(all.carousels[0].status).toBe("source_error");
    expect(all.carousels[0].errors.join("\n")).toMatch(/cda-hvac-carousels-1-2-build-ready\.md: Carousel 1 should have 6 slides but 5 were found/);
    expect(all.carousels[1].status).toBe("source_error");
    expect(all.carousels[1].errors.join("\n")).toMatch(/titled "Some other title"/);
  });

  it("marks a slide with no on-screen text as missing copy and refuses to export", async () => {
    const slides = Array.from({ length: 6 }, (_, i) => (i === 2 ? { text: null } : {}));
    fx.write("cda-hvac-carousels-1-2-build-ready.md", [{ ...SHOOT1.c1, slides }, SHOOT1.c2]);
    const { sources, exporter } = await app();
    const c1 = sources.loadSources().carousels[0];
    expect(c1.status).toBe("missing_copy");
    expect(c1.status_reason).toMatch(/slide 3 has no on-screen text/);
    await expect(exporter.exportCarousel(1)).rejects.toThrow(/Missing copy in source file — do not generate text/);
  });
});

describe("export", () => {
  it("exports carousel 1 as 6 text-slide JPGs with caption, GBP, manifest and selects map", async () => {
    const { exporter, sources } = await app();
    const res = await exporter.exportCarousel(1);
    expect(res.folder_name).toBe("carousel-01-sized-wrong-not-just-old");
    expect(res.files).toEqual([
      "carousel-01-slide-01.jpg", "carousel-01-slide-02.jpg", "carousel-01-slide-03.jpg",
      "carousel-01-slide-04.jpg", "carousel-01-slide-05.jpg", "carousel-01-slide-06.jpg",
      "caption.txt", "gbp.txt", "manifest.json", "selects-map.md",
    ]);
    for (const f of res.files.filter((f) => f.endsWith(".jpg"))) {
      const meta = await sharp(path.join(res.folder, f)).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 1080, 1350]);
    }
    const parsed = sources.loadSources().carousels[0].parsed!;
    expect(readExport(res.folder, "caption.txt")).toBe(`${parsed.caption}\n\n${parsed.hashtags}\n`);
    expect(readExport(res.folder, "gbp.txt")).toBe(`${parsed.gbp_line}\n`);

    const manifest = JSON.parse(readExport(res.folder, "manifest.json"));
    expect(manifest.carousel).toMatchObject({ id: 1, title: "Sized wrong, not just old" });
    expect(manifest.template).toMatchObject({ width: 1080, height: 1350, jpg_quality: 90 });
    expect(manifest.slides).toHaveLength(6);
    for (const [i, s] of manifest.slides.entries()) {
      expect(s.photo).toBe("text-slide fallback");
      expect(s.fallback_reason).toBe("no photo assigned");
      expect(s.on_screen_text).toBe(parsed.slides[i].on_screen_text);
      expect(s.edited_from_source).toBe(false);
    }
    const map = readExport(res.folder, "selects-map.md");
    expect(map).toMatch(/## Slide 6/);
    expect(map).toMatch(/\[x\] Fallback used: text slide — no photo assigned/);
  });

  it("exports carousel 2 as 7 slides", async () => {
    const { exporter } = await app();
    const res = await exporter.exportCarousel(2);
    expect(res.files.filter((f) => f.endsWith(".jpg"))).toHaveLength(7);
  });

  it("blocks an inside-home photo until permission is Y, and flags it in the manifest", async () => {
    const { exporter, store, photos } = await app();
    await photos.savePhoto("DSC_0101.jpg", await solidJpg(2160, 2700, "#00ff00"));
    store.updateCarouselState(1, (cs) => {
      cs.slides["1"] = { ...store.defaultSlideState(), photo_filename: "DSC_0101.jpg" };
    });

    let res = await exporter.exportCarousel(1);
    let m = JSON.parse(readExport(res.folder, "manifest.json"));
    expect(m.slides[0].photo).toBe("text-slide fallback");
    expect(m.slides[0].permission_flag).toBe("permission unconfirmed");
    expect(m.blocked_slides).toEqual([
      expect.objectContaining({ source_slide: 1, photo_blocked: "DSC_0101.jpg", flag: "permission unconfirmed" }),
    ]);
    let px = await pixel(fs.readFileSync(path.join(res.folder, "carousel-01-slide-01.jpg")), 20, 20);
    expect(px[1]).toBeLessThan(80); // template colour, not the green photo

    store.updateCarouselState(1, (cs) => { cs.slides["1"].permission = "N"; });
    res = await exporter.exportCarousel(1);
    m = JSON.parse(readExport(res.folder, "manifest.json"));
    expect(m.slides[0].permission_flag).toBe("permission denied");
    expect(m.slides[0].photo).toBe("text-slide fallback");

    store.updateCarouselState(1, (cs) => { cs.slides["1"].permission = "Y"; });
    res = await exporter.exportCarousel(1);
    m = JSON.parse(readExport(res.folder, "manifest.json"));
    expect(m.slides[0].photo).toBe("DSC_0101.jpg");
    expect(m.slides[0].permission_flag).toBeNull();
    expect(m.blocked_slides).toEqual([]);
    px = await pixel(fs.readFileSync(path.join(res.folder, "carousel-01-slide-01.jpg")), 20, 20);
    expect(px[1]).toBeGreaterThan(200); // the photo is there
    expect(readExport(res.folder, "selects-map.md")).toMatch(/- Filename: DSC_0101\.jpg/);
  });

  it("refuses to enlarge a small photo without an explicit yes", async () => {
    const { exporter, store, photos } = await app();
    await photos.savePhoto("small.jpg", await solidJpg(540, 675, "#0000ff"));
    store.updateCarouselState(1, (cs) => {
      cs.slides["2"] = { ...store.defaultSlideState(), photo_filename: "small.jpg", permission: "Y" };
    });
    await expect(exporter.exportCarousel(1)).rejects.toThrow(/enlarged 100% past its native resolution/);
    store.updateCarouselState(1, (cs) => { cs.slides["2"].upscale_ack = true; });
    const res = await exporter.exportCarousel(1);
    const m = JSON.parse(readExport(res.folder, "manifest.json"));
    expect(m.slides[1].upscaled).toEqual({ factor: 2, accepted_by_austin: true });
  });

  it("rejects videos and keeps file names unique", async () => {
    const { photos } = await app();
    await expect(photos.savePhoto("clip.mp4", Buffer.from("x"))).rejects.toThrow(/stills only/);
    await photos.savePhoto("a.jpg", await solidJpg(100, 100, "#ff0000"));
    await photos.savePhoto("a.jpg", await solidJpg(100, 100, "#ff0000")); // same bytes: fine
    await expect(photos.savePhoto("a.jpg", await solidJpg(100, 100, "#00ff00"))).rejects.toThrow(/already in the library/);
  });

  it("will not export carousels 3 and 8, even if a file for them is dropped in", async () => {
    fx.write("carousel-3-build-ready.md", [{ id: 3, title: "What commissioning actually is", slides: 6 }]);
    fx.write("new/carousel-08-build-ready.md", [{ id: 8, title: "Maintenance plan, explained", slides: 6 }]);
    const { exporter, sources, service } = await app();
    const all = sources.loadSources();
    expect(all.carousels.find((c) => c.id === 3)!.status).toBe("blocked");
    expect(all.carousels.find((c) => c.id === 3)!.parsed).toBeNull();
    expect(all.carousels.find((c) => c.id === 8)!.status).toBe("blocked");
    await expect(exporter.exportCarousel(3)).rejects.toThrow(/blocked.*commissioning close-ups/);
    await expect(exporter.exportCarousel(8)).rejects.toThrow(/blocked.*Erika/);
    const d = await service.getDetail(3);
    expect(() => exporter.canvaCsv(d!)).toThrow(/blocked/);
  });

  it("requires explicit confirmation for a 'years old' line", async () => {
    const slides = Array.from({ length: 6 }, (_, i) => (i === 1 ? { text: "This fixture unit was 22 years old." } : {}));
    fx.write("cda-hvac-carousels-1-2-build-ready.md", [{ ...SHOOT1.c1, slides }, SHOOT1.c2]);
    const { exporter, store, service } = await app();
    await expect(exporter.exportCarousel(1)).rejects.toThrow(/22 years old.*must not be reused/);

    const d = await service.getDetail(1);
    const occ = d!.plan.age_occurrences[0];
    expect(occ).toMatchObject({ key: "slide-2-text", reel1_line: true, confirmed: false });
    store.updateCarouselState(1, (cs) => {
      cs.age_confirmations[occ.key] = { text: occ.text, confirmed_at: "2026-11-11T00:00:00.000Z" };
    });
    const res = await exporter.exportCarousel(1);
    const m = JSON.parse(readExport(res.folder, "manifest.json"));
    expect(m.confirmations).toEqual([
      expect.objectContaining({ where: "Slide 2 on-screen text", reel_1_22_years_old_line: true, confirmed: true }),
    ]);

    // If the source line changes, the old confirmation no longer counts.
    slides[1] = { text: "This fixture unit was 23 years old." };
    fx.write("cda-hvac-carousels-1-2-build-ready.md", [{ ...SHOOT1.c1, slides }, SHOOT1.c2]);
    await expect(exporter.exportCarousel(1)).rejects.toThrow(/years old/);
  });

  it("rejects a price or percentage in edited text, but allows it word for word from the file", async () => {
    const { exporter, store, sources } = await app();
    const src = sources.loadSources().carousels[0].parsed!.slides[0].on_screen_text!;
    const edit = (text: string) =>
      store.updateCarouselState(1, (cs) => {
        cs.slides["1"] = {
          ...store.defaultSlideState(),
          override: { text, source_text_at_edit: src, edited_at: "2026-11-11T00:00:00.000Z" },
        };
      });
    edit("Now only $4,500");
    await expect(exporter.exportCarousel(1)).rejects.toThrow(/edited text contains a price/);
    edit("Saves 30% on bills");
    await expect(exporter.exportCarousel(1)).rejects.toThrow(/edited text contains a percentage claim/);
    edit("About 15 years old");
    await expect(exporter.exportCarousel(1)).rejects.toThrow(/edited text contains a "years old" age/);

    edit("A reworded fixture line");
    const res = await exporter.exportCarousel(1);
    const m = JSON.parse(readExport(res.folder, "manifest.json"));
    expect(m.slides[0]).toMatchObject({
      edited_from_source: true,
      on_screen_text: "A reworded fixture line",
      edit: { flag: "Edited from source file", old_text: src, new_text: "A reworded fixture line" },
    });
    // The source Markdown file is never rewritten.
    expect(fs.readFileSync(path.join(fx.content, "cda-hvac-carousels-1-2-build-ready.md"), "utf8")).toContain(src);

    // Verbatim from a build-ready file: allowed, with a notice.
    const slides = Array.from({ length: 7 }, (_, i) => (i === 0 ? { text: "Fixture verbatim $100 line" } : {}));
    fx.write("cda-hvac-carousels-1-2-build-ready.md", [SHOOT1.c1, { ...SHOOT1.c2, slides }]);
    const res2 = await exporter.exportCarousel(2);
    const m2 = JSON.parse(readExport(res2.folder, "manifest.json"));
    expect(m2.notices.join("\n")).toMatch(/Slide 1: contains a price \("\$100"\) — exported only because it is word for word/);
  });

  it("flags an edit when the source text changed underneath it", async () => {
    const { exporter, store } = await app();
    store.updateCarouselState(1, (cs) => {
      cs.slides["1"] = {
        ...store.defaultSlideState(),
        override: { text: "Edited fixture", source_text_at_edit: "Some older source text", edited_at: "x" },
      };
    });
    await expect(exporter.exportCarousel(1)).rejects.toThrow(/source file's text changed after this slide was edited/);
  });

  it("carousel 6 slide 5: natural-moment photo only, or drop the slide and renumber", async () => {
    const { exporter, store, photos, service } = await app();
    await photos.savePhoto("crew_6am.jpg", await solidJpg(2160, 2700, "#ff0000"));
    store.updateCarouselState(6, (cs) => {
      cs.slides["5"] = { ...store.defaultSlideState(), photo_filename: "crew_6am.jpg", permission: "Y" };
    });
    let d = await service.getDetail(6);
    let s5 = d!.plan.slides[4];
    expect(s5).toMatchObject({ droppable: true, natural_moment_only: true, photo_used: null });
    expect(s5.fallback_reason).toMatch(/natural, unstaged moment/);
    expect(d!.plan.slides.filter((s) => s.droppable).map((s) => s.number)).toEqual([5]);

    store.updateCarouselState(6, (cs) => { cs.slides["5"].natural_confirmed = true; });
    d = await service.getDetail(6);
    expect(d!.plan.slides[4].photo_used).toBe("crew_6am.jpg");

    store.updateCarouselState(6, (cs) => { cs.slides["5"].dropped = true; });
    const res = await exporter.exportCarousel(6);
    expect(res.files.filter((f) => f.endsWith(".jpg"))).toEqual([
      "carousel-06-slide-01.jpg", "carousel-06-slide-02.jpg", "carousel-06-slide-03.jpg",
      "carousel-06-slide-04.jpg", "carousel-06-slide-05.jpg",
    ]);
    const m = JSON.parse(readExport(res.folder, "manifest.json"));
    expect(m.slides.map((s: { source_slide: number }) => s.source_slide)).toEqual([1, 2, 3, 4, 6]);
    expect(m.dropped_slides).toEqual([expect.objectContaining({ source_slide: 5 })]);

    // Dropping is offered for that slot only.
    store.updateCarouselState(6, (cs) => { cs.slides["2"] = { ...store.defaultSlideState(), dropped: true }; });
    d = await service.getDetail(6);
    expect(d!.plan.slides[1].dropped).toBe(false);
  });

  it("carousel 7 slide 5 cannot be edited or expanded", async () => {
    const { exporter, store, sources } = await app();
    const src = sources.loadSources().carousels.find((c) => c.id === 7)!.parsed!.slides[4].on_screen_text!;
    store.updateCarouselState(7, (cs) => {
      cs.slides["5"] = {
        ...store.defaultSlideState(),
        override: { text: "Fixture expanded plan details", source_text_at_edit: src, edited_at: "x" },
      };
    });
    await expect(exporter.exportCarousel(7)).rejects.toThrow(/Slide 5: this slide's text is locked/);
  });

  it("brand-slide fallback needs the business name from settings — never a made-up one", async () => {
    const slides = Array.from({ length: 6 }, (_, i) =>
      i === 5 ? { fallback: "plain brand slide with the business name and the CTA text" } : {},
    );
    fx.write("cda-hvac-carousels-1-2-build-ready.md", [{ ...SHOOT1.c1, slides }, SHOOT1.c2]);
    const { exporter, store } = await app();
    await expect(exporter.exportCarousel(1)).rejects.toThrow(/no business name is set/);
    store.saveSettings({ business_name: "Fixture Business Name" });
    const res = await exporter.exportCarousel(1);
    const m = JSON.parse(readExport(res.folder, "manifest.json"));
    expect(m.slides[5].slide_type).toBe("plain brand slide");
    expect(m.template.business_name).toBe("Fixture Business Name");
  });

  it("writes a Canva Bulk Create CSV with one row per slide", async () => {
    const { exporter, store, photos, service, sources } = await app();
    await photos.savePhoto("IMG_0007.jpg", await solidJpg(2160, 2700, "#00ff00"));
    store.updateCarouselState(2, (cs) => {
      cs.slides["3"] = { ...store.defaultSlideState(), photo_filename: "IMG_0007.jpg", permission: "Y" };
    });
    const csv = exporter.canvaCsv((await service.getDetail(2))!);
    const rows = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(rows[0]).toBe("carousel,slide,on-screen text,small line,photo filename");
    expect(rows).toHaveLength(8);
    const parsed = sources.loadSources().carousels[1].parsed!;
    expect(rows[1]).toBe(`Carousel 2 — Old furnace out. New furnace in. One day.,1,${parsed.slides[0].on_screen_text},,`);
    expect(rows[3]).toBe(`Carousel 2 — Old furnace out. New furnace in. One day.,3,${parsed.slides[2].on_screen_text},,IMG_0007.jpg`);
  });

  it("a new carousel saves as Markdown, reads back, and exports", async () => {
    const { markdown, sources, exporter } = await app();
    const input = {
      id: 9,
      title: "Fixture shoot two carousel",
      pairs_with: null,
      slides: Array.from({ length: 6 }, (_, i) => ({
        photo_needed: `Fixture new photo ${i + 1}`,
        on_screen_text: `Typed fixture line ${i + 1}`,
        small_line: i === 0 ? "Typed small line" : null,
        fallback_text: markdown.DEFAULT_FALLBACK,
        inside_home: i < 3,
      })),
      caption: "Typed fixture caption.",
      hashtags: "#typedfixture",
      gbp_line: "Typed fixture GBP line.",
    };
    expect(markdown.validateNewCarousel(input)).toEqual([]);
    fx.writeRaw(`new/${markdown.newCarouselFileName(9, input.title)}`, markdown.writeCarouselMarkdown(input, "2026-11-11"));

    const c9 = sources.loadSources().carousels.find((c) => c.id === 9)!;
    expect(c9).toMatchObject({ status: "ready", origin: "created", title: input.title });
    expect(c9.parsed!.slides.map((s) => s.on_screen_text)).toEqual(input.slides.map((s) => s.on_screen_text));

    const res = await exporter.exportCarousel(9);
    expect(res.folder_name).toBe("carousel-09-fixture-shoot-two-carousel");
    expect(res.files.filter((f) => f.endsWith(".jpg"))).toHaveLength(6);
    expect(readExport(res.folder, "caption.txt")).toBe("Typed fixture caption.\n\n#typedfixture\n");
    expect(readExport(res.folder, "gbp.txt")).toBe("Typed fixture GBP line.\n");
  });
});

describe("nothing leaves the machine", () => {
  it("has no code that posts, schedules or sends", () => {
    const dir = path.join(__dirname, "..", "src");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name)) files.push(p);
      }
    };
    walk(dir);
    const offenders: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      // Outbound network: any absolute URL fetch, mail, or social / GBP API host.
      if (/fetch\(\s*["'`]https?:/.test(src) || /https?:\/\/(?!www\.w3\.org)/.test(src)) offenders.push(`${f}: absolute URL`);
      if (/graph\.facebook|instagram\.com|googleapis|mybusiness|nodemailer|smtp|sendgrid|twilio|setInterval|node-cron/i.test(src)) {
        offenders.push(`${f}: posting / scheduling / sending code`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
