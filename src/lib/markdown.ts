// Writes a new carousel in the same Markdown shape the parser reads, so
// carousels made in the app and carousels written by hand are one format.

import { typedTextProblems } from "./gates";
import { pad2, slugify } from "./slug";

export interface NewSlideInput {
  photo_needed: string;
  on_screen_text: string;
  small_line?: string | null;
  fallback_text: string;
  inside_home: boolean;
}

export interface NewCarouselInput {
  id: number;
  title: string;
  pairs_with?: string | null;
  slides: NewSlideInput[];
  caption: string;
  hashtags: string;
  gbp_line: string;
}

export const DEFAULT_FALLBACK = "plain text slide, same words, no photo";

const hasDoubleQuote = (s: string) => /["“”]/.test(s);

/** Returns a list of problems; empty means the carousel can be saved. */
export function validateNewCarousel(input: NewCarouselInput): string[] {
  const p: string[] = [];
  const title = input.title.trim();
  if (!title) p.push("Title is required.");
  if (hasDoubleQuote(title)) p.push("Title: use single quotes or apostrophes, not double quotes.");
  if (/[\r\n]/.test(title)) p.push("Title must be one line.");
  if (input.slides.length < 2 || input.slides.length > 10) {
    p.push("A carousel needs between 2 and 10 slides (6–7 is the usual).");
  }
  input.slides.forEach((s, i) => {
    const n = i + 1;
    if (!s.photo_needed.trim()) p.push(`Slide ${n}: say what photo is needed.`);
    if (!s.on_screen_text.trim()) p.push(`Slide ${n}: on-screen text is required — the app will not write it.`);
    if (!s.fallback_text.trim()) p.push(`Slide ${n}: fallback is required.`);
    for (const [name, v] of [
      ["on-screen text", s.on_screen_text],
      ["small line", s.small_line ?? ""],
    ] as const) {
      if (hasDoubleQuote(v)) p.push(`Slide ${n} ${name}: use single quotes or apostrophes, not double quotes.`);
      for (const why of typedTextProblems(v, { allowAge: true })) {
        p.push(`Slide ${n} ${name} contains ${why}. No prices or percentage claims in carousel copy.`);
      }
    }
    if (/[\r\n]/.test(s.small_line ?? "")) p.push(`Slide ${n}: small line must be one line.`);
    for (const [name, v] of [
      ["photo needed", s.photo_needed],
      ["fallback", s.fallback_text],
    ] as const) {
      if (/[\r\n]/.test(v.trim())) p.push(`Slide ${n}: ${name} must be one line.`);
    }
  });
  if (!input.caption.trim()) p.push("Caption is required.");
  if (!input.hashtags.trim()) p.push("Hashtags are required.");
  if (!input.gbp_line.trim()) p.push("GBP line is required.");
  if (/[\r\n]/.test(input.gbp_line.trim())) p.push("GBP line must be one line.");
  for (const [name, v] of [
    ["Caption", input.caption],
    ["GBP line", input.gbp_line],
  ] as const) {
    for (const why of typedTextProblems(v, { allowAge: true })) {
      p.push(`${name} contains ${why}. No prices or percentage claims in public copy.`);
    }
    if (/^\s*(#{1,6}\s|\*\*|__)/m.test(v)) {
      p.push(`${name}: lines cannot start with # or ** (those are Markdown headings in the saved file).`);
    }
  }
  return p;
}

const quoteLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `"${l}"`)
    .join(" / ");

export function newCarouselFileName(id: number, title: string): string {
  return `carousel-${pad2(id)}-${slugify(title)}-build-ready.md`;
}

export function writeCarouselMarkdown(input: NewCarouselInput, createdOn: string): string {
  const L: string[] = [];
  L.push("# CDA HVAC — build-ready carousel file");
  L.push("");
  L.push(
    `Created in CDA HVAC Carousel Builder on ${createdOn}. Every word below was typed by a person. To change the copy, edit this file in a text editor — the app re-reads it and never rewrites it.`,
  );
  L.push("");
  L.push(`## Carousel ${input.id} — "${input.title.trim()}" (${input.slides.length} slides)`);
  L.push("");
  if (input.pairs_with?.trim()) {
    L.push(`- **Pairs with:** ${input.pairs_with.trim()}`);
  }
  L.push("- **Job ID:** none");
  L.push("");
  input.slides.forEach((s, i) => {
    L.push(`### Slide ${i + 1}${i === input.slides.length - 1 ? " — CTA" : ""}`);
    L.push("");
    L.push(`- **Photo needed:** ${s.photo_needed.trim()}`);
    L.push(`- **Inside home:** ${s.inside_home ? "yes — homeowner permission needed" : "no"}`);
    L.push(`- **On-screen text:** ${quoteLines(s.on_screen_text)}`);
    if (s.small_line?.trim()) L.push(`- **Small line:** "${s.small_line.trim()}"`);
    L.push(`- **Fallback:** ${s.fallback_text.trim()}`);
    L.push("");
  });
  L.push("### Caption");
  L.push("");
  L.push(input.caption.replace(/\r\n?/g, "\n").trim());
  L.push("");
  L.push("### Hashtags");
  L.push("");
  L.push(input.hashtags.replace(/\r\n?/g, "\n").trim());
  L.push("");
  L.push("### GBP repurpose");
  L.push("");
  L.push(input.gbp_line.trim());
  L.push("");
  return L.join("\n");
}
