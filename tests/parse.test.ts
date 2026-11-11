import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractQuoted, parseBuildReady } from "@/lib/parse";
import { MISSING_COPY_MESSAGE } from "@/lib/types";
import {
  newCarouselFileName,
  validateNewCarousel,
  writeCarouselMarkdown,
  type NewCarouselInput,
} from "@/lib/markdown";
import { parseSelectsMap } from "@/lib/selectsMap";

const fixture = fs.readFileSync(path.join(__dirname, "fixtures/fixture-build-ready.md"), "utf8");

describe("parseBuildReady", () => {
  const pf = parseBuildReady("fixture-build-ready.md", fixture);

  it("finds both carousels with titles, counts and pairing", () => {
    expect(pf.errors).toEqual([]);
    expect(pf.carousels.map((c) => c.id)).toEqual([1, 2]);
    const c1 = pf.carousels[0];
    expect(c1.title).toBe("Fixture title one");
    expect(c1.declared_slide_count).toBe(3);
    expect(c1.pairs_with).toBe("Fixture Reel A");
    expect(c1.errors).toEqual([]);
    expect(c1.slides).toHaveLength(3);
  });

  it("keeps on-screen text word for word", () => {
    const [s1, s2, s3] = pf.carousels[0].slides;
    expect(s1.on_screen_text).toBe("Fixture line one.");
    expect(s1.small_line).toBe("Fixture small line one");
    expect(s1.label).toBe("Hook");
    expect(s1.photo_needed).toBe("Fixture photo description one");
    expect(s1.fallback_text).toBe("plain text slide, same words, no photo");
    expect(s2.on_screen_text).toBe("Fixture line two, part A.\nFixture line two, part B.");
    expect(s2.small_line).toBeNull();
    expect(s3.on_screen_text).toBe("Fixture call to action");
    expect(s3.fallback_text).toMatch(/brand slide/);
  });

  it("requires permission unless the file says the photo is not inside a home", () => {
    const [s1, , s3] = pf.carousels[0].slides;
    expect(s1.permission_required).toBe(true);
    expect(s3.permission_required).toBe(false);
  });

  it("keeps caption, hashtags and GBP line exactly", () => {
    const c1 = pf.carousels[0];
    expect(c1.caption).toBe(
      "Fixture caption first paragraph, with an apostrophe: it's here.\n\nFixture caption second paragraph — with a dash.",
    );
    expect(c1.hashtags).toBe("#fixtureone #fixturetwo #fixturethree");
    expect(c1.gbp_line).toBe("Fixture GBP line, exactly one line.");
  });

  it("reads slides from a table and inline end sections", () => {
    const c2 = pf.carousels[1];
    expect(c2.errors).toEqual([]);
    expect(c2.slides.map((s) => s.on_screen_text)).toEqual([
      "Fixture table line one",
      "Fixture table line two",
    ]);
    expect(c2.slides[0].small_line).toBe("Fixture table small");
    expect(c2.slides[1].small_line).toBeNull();
    expect(c2.caption).toBe("Fixture table caption.");
    expect(c2.hashtags).toBe("#fixturetable");
    expect(c2.gbp_line).toBe("Fixture table GBP line.");
  });

  it("blocks a slide with no on-screen text instead of filling it in", () => {
    const md = fixture.replace('- **On-screen text:** "Fixture line one."\n', "");
    const c1 = parseBuildReady("f.md", md).carousels[0];
    expect(c1.slides[0].on_screen_text).toBeNull();
    expect(c1.slides[0].blocked).toBe(MISSING_COPY_MESSAGE);
    expect(c1.slides[1].blocked).toBeNull();
  });

  it("treats an empty or TBD on-screen text as missing", () => {
    for (const v of ['""', "TBD", "—", ""]) {
      const md = fixture.replace('"Fixture line one."', v);
      const c1 = parseBuildReady("f.md", md).carousels[0];
      expect(c1.slides[0].blocked, `value: ${v}`).toBe(MISSING_COPY_MESSAGE);
    }
  });

  it("fails loudly, naming file and slide, when a slide is missing", () => {
    const md = fixture.replace("### Slide 2\n", "### Slide 4\n");
    const c1 = parseBuildReady("broken.md", md).carousels[0];
    expect(c1.errors.join("\n")).toMatch(/broken\.md: Carousel 1: expected slide 2 but found slide 4/);
  });

  it("fails loudly when the slide count does not match the heading", () => {
    const md = fixture.replace("(3 slides, pairs", "(4 slides, pairs");
    const c1 = parseBuildReady("broken.md", md).carousels[0];
    expect(c1.errors.join("\n")).toMatch(/heading says 4 slides but 3 were found/);
  });

  it("fails loudly when caption, hashtags or GBP line are missing", () => {
    const md = fixture.replace("### GBP repurpose\n\nFixture GBP line, exactly one line.\n", "");
    const c1 = parseBuildReady("broken.md", md).carousels[0];
    expect(c1.errors.join("\n")).toMatch(/broken\.md: Carousel 1: no GBP repurpose line/);
  });

  it("reports a file with no carousel in it", () => {
    const pf2 = parseBuildReady("empty.md", "# Notes\n\nNothing here.\n");
    expect(pf2.errors.join("\n")).toMatch(/empty\.md: no carousel found/);
  });

  it("ignores a document heading that only mentions carousel numbers", () => {
    const md = "# Carousel 1 and 2 — build-ready\n\n" + fixture;
    const pf2 = parseBuildReady("f.md", md);
    expect(pf2.carousels.map((c) => c.id)).toEqual([1, 2]);
    expect(pf2.carousels[0].errors).toEqual([]);
  });

  it("handles plain-label and curly-quote variants", () => {
    const md = [
      '## Carousel 9: “Curly fixture” — 2 slides',
      "",
      "**Slide 1**",
      "Photo: fixture photo",
      "On-screen text: “Curly fixture line”",
      "Fallback: plain text slide, same words, no photo",
      "",
      "**Slide 2**",
      "Photo: fixture photo",
      'Text on screen: "Plain label line"',
      "Fallback: plain text slide",
      "",
      "## Caption",
      "> Quoted caption line",
      "## Hashtags",
      "```",
      "#a #b",
      "```",
      "## GBP post",
      '"One GBP line"',
    ].join("\n");
    const c = parseBuildReady("v.md", md).carousels[0];
    expect(c.errors).toEqual([]);
    expect(c.title).toBe("Curly fixture");
    expect(c.declared_slide_count).toBe(2);
    expect(c.slides[0].on_screen_text).toBe("Curly fixture line");
    expect(c.slides[1].on_screen_text).toBe("Plain label line");
    expect(c.caption).toBe("Quoted caption line");
    expect(c.hashtags).toBe("#a #b");
    expect(c.gbp_line).toBe("One GBP line");
  });
});

describe("extractQuoted", () => {
  it("strips only the delimiting quotes", () => {
    expect(extractQuoted('"It\'s one line."').text).toBe("It's one line.");
    expect(extractQuoted('"A" / "B"').text).toBe("A\nB");
    expect(extractQuoted("unquoted words").quoted).toBe(false);
    expect(extractQuoted('"Words" (CTA)').note).toBe("(CTA)");
    expect(extractQuoted("  ").text).toBeNull();
  });
});

describe("new carousel Markdown", () => {
  const input: NewCarouselInput = {
    id: 9,
    title: "Fixture new carousel",
    pairs_with: "Fixture Reel Z",
    slides: [
      { photo_needed: "Fixture photo A", on_screen_text: "Typed line A", small_line: "Typed small A", fallback_text: "plain text slide, same words, no photo", inside_home: true },
      { photo_needed: "Fixture photo B", on_screen_text: "Typed line B1\nTyped line B2", small_line: "", fallback_text: "plain text slide, same words, no photo", inside_home: false },
      { photo_needed: "Fixture photo C", on_screen_text: "Typed CTA", small_line: null, fallback_text: "plain brand slide with the business name and the CTA text", inside_home: false },
    ],
    caption: "Typed caption line one.\n\nTyped caption line two.",
    hashtags: "#typedone #typedtwo",
    gbp_line: "Typed GBP line.",
  };

  it("round-trips through the parser unchanged", () => {
    expect(validateNewCarousel(input)).toEqual([]);
    const md = writeCarouselMarkdown(input, "2026-11-11");
    const pf = parseBuildReady(newCarouselFileName(9, input.title), md);
    expect(pf.errors).toEqual([]);
    const c = pf.carousels[0];
    expect(c.errors).toEqual([]);
    expect(c.id).toBe(9);
    expect(c.title).toBe(input.title);
    expect(c.pairs_with).toBe("Fixture Reel Z");
    expect(c.job_id).toBeNull();
    expect(c.slides.map((s) => s.on_screen_text)).toEqual([
      "Typed line A",
      "Typed line B1\nTyped line B2",
      "Typed CTA",
    ]);
    expect(c.slides.map((s) => s.small_line)).toEqual(["Typed small A", null, null]);
    expect(c.slides.map((s) => s.permission_required)).toEqual([true, false, false]);
    expect(c.slides.map((s) => s.photo_needed)).toEqual(input.slides.map((s) => s.photo_needed));
    expect(c.slides[2].fallback_text).toBe(input.slides[2].fallback_text);
    expect(c.caption).toBe(input.caption);
    expect(c.hashtags).toBe(input.hashtags);
    expect(c.gbp_line).toBe(input.gbp_line);
  });

  it("rejects prices, percentages and missing copy", () => {
    const bad = structuredClone(input);
    bad.slides[0].on_screen_text = "Only $99 today";
    bad.slides[1].on_screen_text = "";
    bad.caption = "Save 20% this week";
    const p = validateNewCarousel(bad).join("\n");
    expect(p).toMatch(/Slide 1 on-screen text contains a price/);
    expect(p).toMatch(/Slide 2: on-screen text is required/);
    expect(p).toMatch(/Caption contains a percentage claim/);
  });
});

describe("parseSelectsMap", () => {
  it("reads recorded file names per slide, and ignores blanks", () => {
    const md = [
      "## Carousel 1",
      "### Slide 1",
      "- [x] Photo needed: fixture",
      "- Filename: DSC_0001.jpg",
      "### Slide 2",
      "- [ ] Photo needed: fixture",
      "- Filename: ____________",
      "## Carousel 2",
      "| Slide | Photo | Filename | Fallback |",
      "|---|---|---|---|",
      "| 1 | fixture | IMG 0042 (1).JPG | text |",
      "| 2 | fixture | | text |",
    ].join("\n");
    const m = parseSelectsMap(md);
    expect(m.get(1)?.get(1)).toBe("DSC_0001.jpg");
    expect(m.get(1)?.has(2)).toBe(false);
    expect(m.get(2)?.get(1)).toBe("IMG 0042 (1).JPG");
    expect(m.get(2)?.has(2)).toBe(false);
  });
});
