// Selects maps: the tick sheet that ties each slide slot to a photo file name.
//
// Two jobs:
//   1. Read file names already recorded in a hand-written selects map, so a
//      photo with exactly that file name can be matched to its slot. This is
//      the only auto-matching the app does — it never guesses which photo fits.
//   2. Write a selects map for any carousel, so a build is traceable back to
//      the Nov 2 selects.

import type { Carousel, CarouselPlan, ParsedCarousel } from "./types";

const IMAGE_NAME = /([A-Za-z0-9][A-Za-z0-9 _\-().]*\.(?:jpe?g|png|webp|tiff?))\b/i;

/** carousel id -> slide number -> recorded file name */
export type RecordedSelects = Map<number, Map<number, string>>;

export function parseSelectsMap(markdown: string): RecordedSelects {
  const out: RecordedSelects = new Map();
  let carousel: number | null = null;
  let slide: number | null = null;
  let fileCol = -1;
  let slideCol = -1;

  const record = (name: string) => {
    if (carousel === null || slide === null) return;
    if (!out.has(carousel)) out.set(carousel, new Map());
    const m = out.get(carousel)!;
    if (!m.has(slide)) m.set(slide, name.trim());
  };

  for (const raw of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const clean = raw
      .trim()
      .replace(/^(>\s?)+/, "")
      .replace(/^#{1,6}\s+/, "")
      .replace(/^([-*+]|\d+[.)])\s+/, "")
      .replace(/^\[[ xX]\]\s+/, "")
      .replace(/\*\*|__|`/g, "")
      .trim();

    const cm = clean.match(/^Carousel\s+#?(\d+)\b/i);
    if (cm) {
      carousel = Number(cm[1]);
      slide = null;
      fileCol = slideCol = -1;
      continue;
    }

    if (/^\s*\|/.test(raw)) {
      const cells = raw
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.replace(/\*\*|__|`/g, "").trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      if (fileCol === -1) {
        const f = cells.findIndex((c) => /file\s*name|filename|^file$/i.test(c));
        const s = cells.findIndex((c) => /^(slide|#|slide\s*#|slot)$/i.test(c));
        if (f !== -1 && s !== -1) {
          fileCol = f;
          slideCol = s;
          continue;
        }
      } else {
        const n = (cells[slideCol] ?? "").match(/(\d+)/);
        const name = (cells[fileCol] ?? "").match(IMAGE_NAME);
        if (n && name) {
          slide = Number(n[1]);
          record(name[1]);
        }
        continue;
      }
    }

    const sm = clean.match(/^Slide\s+#?(\d+)\b/i);
    if (sm) slide = Number(sm[1]);

    const fm = clean.match(/\b(?:file\s*name|filename|file)\b[^:]*:\s*(.*)$/i);
    if (fm) {
      const name = fm[1].match(IMAGE_NAME);
      if (name) record(name[1]);
    }
  }
  return out;
}

const blank = "______________________";

/** Tick sheet for one carousel. With a plan, it records what the export used. */
export function writeSelectsMap(
  carousel: Carousel,
  parsed: ParsedCarousel,
  plan: CarouselPlan,
  opts: { date: string; exported: boolean; selects_source: string },
): string {
  const L: string[] = [];
  L.push(`# CDA HVAC — Carousel ${carousel.id} selects map`);
  L.push("");
  L.push(`Carousel ${carousel.id} — "${parsed.title}" (${parsed.slides.length} slides)`);
  L.push("");
  L.push(`- Copy source: ${carousel.source_file ?? "(none)"}`);
  L.push(`- Photos come from: ${opts.selects_source}`);
  L.push(
    opts.exported
      ? `- Written by Carousel Builder at export, ${opts.date}. Records the photo actually used in each slot.`
      : `- Written by Carousel Builder, ${opts.date}. Not exported yet — blank file names are slots with no photo assigned.`,
  );
  L.push("- A ticked box means the slot has a real photo from the selects. An empty box means the fallback is used.");
  L.push("");

  for (const s of parsed.slides) {
    const p = plan.slides.find((x) => x.number === s.number)!;
    L.push(`## Slide ${s.number}${s.label ? ` — ${s.label}` : ""}`);
    L.push("");
    if (p.dropped) {
      L.push("- [ ] Slide dropped — not exported (no natural-moment photo; not staged).");
      L.push(`- Photo needed: ${s.photo_needed ?? "(not stated in source file)"}`);
      L.push("");
      continue;
    }
    L.push(`- [${p.photo_used ? "x" : " "}] Photo needed: ${s.photo_needed ?? "(not stated in source file)"}`);
    L.push(`- Filename: ${p.photo_used ?? (p.photo_assigned ? `${blank} (assigned ${p.photo_assigned} — not used: ${p.fallback_reason})` : blank)}`);
    L.push(
      `- Homeowner permission (inside-home photo): ${p.permission_required ? p.permission : "not needed — not an inside-home photo"}`,
    );
    L.push(`- Fallback: ${s.fallback_text ?? "plain text slide, same words, no photo"}`);
    L.push(
      p.photo_used
        ? "- [ ] Fallback used: no"
        : `- [x] Fallback used: ${p.mode === "brand" ? "plain brand slide" : "text slide"} — ${p.fallback_reason}`,
    );
    if (opts.exported && p.export_index !== null) {
      L.push(`- Exported as: slide ${String(p.export_index).padStart(2, "0")}`);
    }
    L.push("");
  }
  return L.join("\n");
}
