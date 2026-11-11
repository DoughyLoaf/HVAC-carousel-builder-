// Parser for build-ready carousel Markdown files.
//
// It reads structure, never writes copy. Rules:
//   - On-screen text is taken word for word from the file.
//   - A slide with no on-screen text is blocked, never filled in.
//   - Structural surprises (missing slide numbers, wrong slide counts, a
//     carousel with no caption) are reported loudly with the file name and
//     slide number. Nothing is skipped silently.
//
// Accepted shape (see README "Build-ready file format"):
//
//   ## Carousel 1 — "Title in quotes" (6 slides, pairs with Reel 1)
//   ### Slide 1
//   - **Photo needed:** ...
//   - **On-screen text:** "Exact words"
//   - **Small line:** "Optional smaller line"
//   - **Fallback:** plain text slide, same words, no photo
//   ...
//   ### Caption
//   ### Hashtags
//   ### GBP repurpose
//
// Heading levels, bold markers and bullets are flexible; slides may also be
// given as a Markdown table with one row per slide.

import {
  MISSING_COPY_MESSAGE,
  type ParsedCarousel,
  type ParsedFile,
  type ParsedSlide,
} from "./types";

type FieldKey =
  | "photo_needed"
  | "on_screen_text"
  | "small_line"
  | "fallback_text"
  | "inside_home";

type SectionKey = "caption" | "hashtags" | "gbp_line";

interface Line {
  raw: string;
  /** Markdown structure stripped: heading hashes, bullets, quote markers, emphasis. */
  clean: string;
  isHeading: boolean;
  /** Whole line (or its leading label) is bold. */
  isBoldLead: boolean;
  isBullet: boolean;
  indent: number;
  no: number;
}

const QUOTE_OPEN = '"“';
const QUOTE_CLOSE = '"”';

function stripEmphasis(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(^|[\s(])\*(?!\s)([^*]+?)\*(?=[\s).,:;!?]|$)/g, "$1$2")
    .replace(/(^|[\s(])_(?!\s)([^_]+?)_(?=[\s).,:;!?]|$)/g, "$1$2")
    .replace(/\*\*/g, "");
}

function toLine(raw: string, no: number): Line {
  const indent = raw.match(/^[ \t]*/)![0].replace(/\t/g, "    ").length;
  let s = raw.trim();
  // Blockquote markers.
  s = s.replace(/^(>\s?)+/, "");
  const isHeading = /^#{1,6}\s+/.test(s);
  s = s.replace(/^#{1,6}\s+/, "").replace(/\s+#+\s*$/, "");
  const isBullet = /^([-*+]|\d+[.)])\s+/.test(s);
  s = s.replace(/^([-*+]|\d+[.)])\s+/, "");
  // Task-list checkboxes.
  s = s.replace(/^\[[ xX]\]\s+/, "");
  const isBoldLead = /^(\*\*|__)/.test(s);
  return {
    raw,
    clean: stripEmphasis(s).trim(),
    isHeading,
    isBoldLead,
    isBullet,
    indent,
    no,
  };
}

const PLACEHOLDER_VALUE =
  /^(?:[-–—_.\s]*|none|n\/a|na|tbd|tbc|todo|\(none\)|\[none\]|no small line|\(no small line\))$/i;

function isPlaceholder(v: string): boolean {
  return PLACEHOLDER_VALUE.test(v.trim());
}

/**
 * Pull the exact quoted words out of a field value.
 *   "One line."                 -> One line.
 *   "Line one." / "Line two."   -> Line one.\nLine two.
 *   unquoted words              -> used as written, with a warning
 */
export function extractQuoted(value: string): {
  text: string | null;
  note: string | null;
  quoted: boolean;
  segments: number;
} {
  const v = value.trim();
  if (isPlaceholder(v)) return { text: null, note: null, quoted: false, segments: 0 };

  const segments: string[] = [];
  let outside = "";
  let i = 0;
  while (i < v.length) {
    const ch = v[i];
    if (QUOTE_OPEN.includes(ch)) {
      const wantCurly = ch === "“";
      let j = i + 1;
      let found = -1;
      while (j < v.length) {
        const c = v[j];
        if (wantCurly ? c === "”" : c === '"') {
          found = j;
          break;
        }
        j++;
      }
      if (found === -1) {
        // Unterminated quote: treat the rest as the segment.
        segments.push(v.slice(i + 1));
        i = v.length;
        break;
      }
      segments.push(v.slice(i + 1, found));
      i = found + 1;
    } else {
      outside += ch;
      i++;
    }
  }

  if (segments.length === 0) {
    return { text: v, note: null, quoted: false, segments: 0 };
  }
  const text = segments.map((s) => s.trim()).join("\n");
  // Whatever sat outside the quotes, minus separators, is a note — not copy.
  const note = outside
    .replace(/[\/|+,;.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    text: text.length ? text : null,
    note: note.length ? note : null,
    quoted: true,
    segments: segments.length,
  };
}

function classifyLabel(label: string): FieldKey | SectionKey | "extra" {
  const l = label.toLowerCase().trim();
  if (/^caption\b/.test(l)) return "caption";
  if (/^hashtags?\b/.test(l)) return "hashtags";
  if (/\bgbp\b|google business/.test(l)) return "gbp_line";
  if (/fallback|if no photo|no[- ]photo/.test(l)) return "fallback_text";
  if (/small|sub-?line|second line|smaller/.test(l)) return "small_line";
  if (/on[- ]?screen|^text\b|^headline\b|^main line\b/.test(l)) return "on_screen_text";
  if (/^(photo|image|shot|still)\b/.test(l)) return "photo_needed";
  if (/inside[- ]home|^permission\b|homeowner permission/.test(l)) return "inside_home";
  return "extra";
}

/** Split "Label: value" (label up to 60 chars, no sentence punctuation). */
function splitLabel(clean: string): { label: string; value: string } | null {
  const m = clean.match(/^([A-Za-z][A-Za-z0-9 \-\/()&'’]{0,58}?)\s*:\s*(.*)$/);
  if (!m) return null;
  return { label: m[1].trim(), value: m[2].trim() };
}

const CAROUSEL_RE = /^Carousel\s+#?(\d+)\b(.*)$/i;
const SLIDE_RE = /^Slide\s+#?(\d+)\b(.*)$/i;
const SECTION_RE =
  /^(Caption|Hashtags?|GBP(?:\s+(?:repurpose|post|line|version))?|Weekly GBP(?:\s+post)?|Google Business Profile(?:\s+post)?)\b\s*(?:\(([^)]*)\))?\s*:?\s*(.*)$/i;

function firstQuoted(s: string): string | null {
  const m = s.match(/["“]([^"”]+)["”]/);
  return m ? m[1].trim() : null;
}

function cleanBlock(lines: string[]): string {
  // Strip code fences and blockquote markers, trim blank edges, keep line breaks.
  const out = lines
    .filter((l) => !/^\s*```/.test(l))
    .map((l) => l.replace(/^\s*(>\s?)+/, "").replace(/\s+$/, ""));
  while (out.length && out[0].trim() === "") out.shift();
  while (out.length && out[out.length - 1].trim() === "") out.pop();
  // Drop a common leading indent.
  const indents = out.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  let text = out.map((l) => l.slice(Math.min(cut, l.length))).join("\n");
  // A block wrapped in one pair of quotes: the quotes are delimiters, not copy.
  const t = text.trim();
  if (
    t.length >= 2 &&
    QUOTE_OPEN.includes(t[0]) &&
    QUOTE_CLOSE.includes(t[t.length - 1]) &&
    !/["“”]/.test(t.slice(1, -1))
  ) {
    text = t.slice(1, -1).trim();
  }
  return text;
}

interface SlideDraft {
  number: number;
  label: string | null;
  line: number;
  fields: Partial<Record<FieldKey, string>>;
  extras: { label: string; value: string }[];
}

interface CarouselDraft {
  id: number;
  headerText: string;
  line: number;
  preamble: Line[];
  slides: SlideDraft[];
  sections: Partial<Record<SectionKey, string[]>>;
  jobId: string | null;
}

function parseTableRow(raw: string): string[] {
  let s = raw.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => stripEmphasis(c.replace(/\\\|/g, "|").trim()));
}

function isTableSeparator(raw: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(raw);
}

export function parseBuildReady(file: string, markdown: string): ParsedFile {
  const rawLines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const lines = rawLines.map((r, i) => toLine(r, i + 1));
  const fileErrors: string[] = [];
  const fileWarnings: string[] = [];
  const drafts: CarouselDraft[] = [];

  let cur: CarouselDraft | null = null;
  let slide: SlideDraft | null = null;
  let field: FieldKey | null = null;
  let section: SectionKey | null = null;
  let tableCols: (FieldKey | "slide" | "extra")[] | null = null;
  let tableHeaders: string[] = [];
  let inFence = false;

  const openQuote = (v: string) => {
    const straight = (v.match(/"/g) || []).length;
    const open = (v.match(/“/g) || []).length;
    const close = (v.match(/”/g) || []).length;
    return straight % 2 === 1 || open > close;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const ln = lines[idx];
    const raw = ln.raw;

    if (/^\s*```/.test(raw)) {
      inFence = !inFence;
      if (section && cur) cur.sections[section]!.push(raw);
      continue;
    }
    if (inFence) {
      if (section && cur) cur.sections[section]!.push(raw);
      continue;
    }

    // Horizontal rule: ends any running field, kept out of sections.
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(raw)) {
      field = null;
      tableCols = null;
      continue;
    }

    // --- Carousel header -------------------------------------------------
    const cm = ln.clean.match(CAROUSEL_RE);
    if (cm && (ln.isHeading || ln.isBoldLead)) {
      cur = {
        id: Number(cm[1]),
        headerText: ln.clean,
        line: ln.no,
        preamble: [],
        slides: [],
        sections: {},
        jobId: null,
      };
      drafts.push(cur);
      slide = null;
      field = null;
      section = null;
      tableCols = null;
      continue;
    }

    if (!cur) continue; // File preamble before the first carousel.

    // --- Slide table -----------------------------------------------------
    if (/^\s*\|/.test(raw) && !section) {
      const cells = parseTableRow(raw);
      if (isTableSeparator(raw)) continue;
      if (!tableCols) {
        const cols = cells.map((c) => {
          if (/^(slide|#|no\.?|slide\s*#|slide no\.?)$/i.test(c.trim())) return "slide" as const;
          const k = classifyLabel(c);
          return k === "caption" || k === "hashtags" || k === "gbp_line" ? ("extra" as const) : k;
        });
        if (cols.includes("slide")) {
          tableCols = cols as (FieldKey | "slide" | "extra")[];
          tableHeaders = cells;
          slide = null;
          field = null;
          continue;
        }
        // Not a slide table — fall through and treat as ordinary text.
      } else {
        const numCell = cells[tableCols.indexOf("slide")] ?? "";
        const nm = numCell.match(/(\d+)/);
        if (!nm) {
          fileErrors.push(
            `${file}: line ${ln.no}: table row under Carousel ${cur.id} has no slide number ("${raw.trim()}").`,
          );
          continue;
        }
        const d: SlideDraft = {
          number: Number(nm[1]),
          label: numCell.replace(/^\s*(slide\s*)?#?\d+\s*[-–—:.)]*\s*/i, "").trim() || null,
          line: ln.no,
          fields: {},
          extras: [],
        };
        tableCols.forEach((col, ci) => {
          const val = (cells[ci] ?? "").replace(/<br\s*\/?>/gi, "\n").trim();
          if (col === "slide") return;
          if (col === "extra") {
            if (val) d.extras.push({ label: tableHeaders[ci] ?? "", value: val });
          } else if (val) {
            d.fields[col] = val;
          }
        });
        cur.slides.push(d);
        continue;
      }
    } else if (tableCols && raw.trim() !== "") {
      tableCols = null;
    }

    // --- Slide header ----------------------------------------------------
    const sm = ln.clean.match(SLIDE_RE);
    if (sm && (ln.isHeading || ln.isBoldLead || ln.indent === 0) && !(field && openQuote(slide?.fields[field] ?? ""))) {
      // "Slide 3: ..." inside a caption would be odd, but a heading always wins.
      if (!section || ln.isHeading || ln.isBoldLead) {
        const rest = sm[2].trim();
        slide = { number: Number(sm[1]), label: null, line: ln.no, fields: {}, extras: [] };
        cur.slides.push(slide);
        field = null;
        section = null;
        // "Slide 1 — Hook" keeps "Hook" as a label; "Slide 1: "text"" is not supported
        // as copy on purpose — copy must sit on an "On-screen text" line.
        const label = rest.replace(/^[\s\-–—:.)(]+/, "").replace(/[)\s]+$/, "").trim();
        slide.label = label || null;
        continue;
      }
    }

    // --- End sections: Caption / Hashtags / GBP ---------------------------
    const secm = ln.clean.match(SECTION_RE);
    if (secm && (ln.isHeading || ln.isBoldLead || (ln.indent === 0 && /:/.test(ln.clean)))) {
      const key = classifyLabel(secm[1]) as SectionKey;
      if (cur.sections[key] !== undefined) {
        fileErrors.push(
          `${file}: line ${ln.no}: Carousel ${cur.id} has more than one "${secm[1]}" section.`,
        );
      }
      section = key;
      slide = null;
      field = null;
      cur.sections[key] = [];
      const inline = (secm[3] ?? "").trim();
      if (inline) cur.sections[key]!.push(inline);
      continue;
    }

    if (section) {
      cur.sections[section]!.push(raw);
      continue;
    }

    // --- Labelled field lines -------------------------------------------
    const lab = splitLabel(ln.clean);
    const continuing = field && slide && openQuote(slide.fields[field] ?? "");
    if (lab && !continuing) {
      const key = classifyLabel(lab.label);
      if (slide) {
        if (key === "extra" || key === "caption" || key === "hashtags" || key === "gbp_line") {
          slide.extras.push({ label: lab.label, value: lab.value });
          field = null;
        } else {
          if (slide.fields[key] !== undefined) {
            fileErrors.push(
              `${file}: line ${ln.no}: Carousel ${cur.id} slide ${slide.number} has "${lab.label}" twice.`,
            );
          }
          slide.fields[key] = lab.value;
          field = key;
        }
      } else {
        if (/^job[ _-]?id$/i.test(lab.label)) {
          cur.jobId = isPlaceholder(lab.value) ? null : lab.value;
        }
        cur.preamble.push(ln);
      }
      continue;
    }

    // --- Continuation / free text ---------------------------------------
    if (slide && field && raw.trim() !== "" && (continuing || ln.indent >= 2)) {
      const sep = field === "on_screen_text" || field === "small_line" ? "\n" : " ";
      slide.fields[field] = `${slide.fields[field] ?? ""}${sep}${ln.clean}`.trim();
      continue;
    }
    if (raw.trim() === "") {
      if (!continuing) field = null;
      continue;
    }
    if (slide) {
      // A loose line inside a slide block: keep it visible as a note.
      slide.extras.push({ label: "Note", value: ln.clean });
      field = null;
    } else {
      cur.preamble.push(ln);
    }
  }

  // --- Build carousels ----------------------------------------------------
  const carousels: ParsedCarousel[] = [];
  const seen = new Map<number, number>();

  for (const d of drafts) {
    const title = firstQuoted(d.headerText);
    const hasContent =
      d.slides.length > 0 || Object.keys(d.sections).length > 0;

    if (!hasContent) {
      // e.g. a document heading like "Carousel 1 and 2 — build-ready".
      fileWarnings.push(
        `${file}: line ${d.line}: heading "${d.headerText}" mentions Carousel ${d.id} but has no slides under it — treated as a document heading.`,
      );
      continue;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    if (seen.has(d.id)) {
      errors.push(
        `${file}: Carousel ${d.id} appears twice (lines ${seen.get(d.id)} and ${d.line}).`,
      );
    }
    seen.set(d.id, d.line);

    let finalTitle = title;
    if (!finalTitle) {
      const rest = d.headerText
        .replace(CAROUSEL_RE, "$2")
        .replace(/\(.*?\)/g, "")
        .replace(/^[\s\-–—:.]+/, "")
        .trim();
      finalTitle = rest || `Carousel ${d.id}`;
      warnings.push(
        `${file}: Carousel ${d.id}: title is not in quotes on its heading (line ${d.line}); using "${finalTitle}".`,
      );
    }

    const headerAndPreamble = [d.headerText, ...d.preamble.map((l) => l.clean)].join("\n");
    const countMatch = headerAndPreamble.match(/(\d+)\s+slides?\b/i) ||
      headerAndPreamble.match(/\bslides?\s*:\s*(\d+)/i);
    const declared = countMatch ? Number(countMatch[1]) : null;
    const pairsMatch = headerAndPreamble.match(/pairs? with:?\s+([^\n;)]+)/i);
    const pairsWith = pairsMatch ? pairsMatch[1].trim().replace(/[.,]+$/, "") : null;

    // Slides: must be numbered 1..N, in order, no gaps.
    if (d.slides.length === 0) {
      errors.push(`${file}: Carousel ${d.id}: no slides found.`);
    }
    d.slides.forEach((s, i) => {
      if (s.number !== i + 1) {
        errors.push(
          `${file}: Carousel ${d.id}: expected slide ${i + 1} but found slide ${s.number} (line ${s.line}). Slides must be numbered in order with none missing.`,
        );
      }
    });
    if (declared !== null && declared !== d.slides.length) {
      errors.push(
        `${file}: Carousel ${d.id}: heading says ${declared} slides but ${d.slides.length} were found. Check slide ${Math.min(declared, d.slides.length) + 1}.`,
      );
    }

    const slides: ParsedSlide[] = d.slides.map((s) => {
      const w: string[] = [];
      const where = `${file}: Carousel ${d.id} slide ${s.number}`;

      const textRaw = s.fields.on_screen_text;
      let text: string | null = null;
      if (textRaw !== undefined) {
        const q = extractQuoted(textRaw);
        text = q.text;
        if (q.text && !q.quoted) {
          w.push(`${where}: on-screen text is not in quotes in the file — used exactly as written.`);
        }
        if (q.segments > 1) {
          w.push(`${where}: on-screen text has ${q.segments} quoted parts — rendered as ${q.segments} lines.`);
        }
        if (q.note) {
          s.extras.push({ label: "Beside on-screen text", value: q.note });
        }
      }

      let small: string | null = null;
      if (s.fields.small_line !== undefined) {
        const q = extractQuoted(s.fields.small_line);
        small = q.text;
        if (q.note) s.extras.push({ label: "Beside small line", value: q.note });
      }

      const photo = s.fields.photo_needed?.trim() || null;
      const fallback = s.fields.fallback_text?.trim() || null;
      if (!photo) w.push(`${where}: no "Photo needed" line in the file.`);
      if (!fallback) {
        w.push(`${where}: no "Fallback" line in the file — a plain text slide is used if there is no photo.`);
      }

      // Inside-home permission: required unless the file explicitly says no.
      let permissionRequired = true;
      let basis = "Not stated in the source file — treated as an inside-home photo until Austin says otherwise.";
      const ih = s.fields.inside_home;
      if (ih !== undefined) {
        if (/^\s*(no|n|false|not required|outside|exterior)\b/i.test(ih)) {
          permissionRequired = false;
          basis = `Source file says: "${ih}".`;
        } else {
          permissionRequired = true;
          basis = `Source file says: "${ih}".`;
        }
      } else if (
        /inside[- ](the |a )?home|in[- ]home|homeowner/i.test(
          [photo ?? "", fallback ?? "", ...s.extras.map((e) => e.value)].join(" "),
        )
      ) {
        basis = "Source file describes this as an inside-home / homeowner photo.";
      }

      return {
        number: s.number,
        label: s.label,
        photo_needed: photo,
        on_screen_text: text,
        small_line: small,
        fallback_text: fallback,
        permission_required: permissionRequired,
        permission_basis: basis,
        extras: s.extras,
        blocked: text ? null : MISSING_COPY_MESSAGE,
        warnings: w,
        line: s.line,
      };
    });

    const sectionText = (k: SectionKey): string | null => {
      const block = d.sections[k];
      if (block === undefined) return null;
      const t = cleanBlock(block);
      return t.trim() ? t : null;
    };
    const caption = sectionText("caption");
    const hashtags = sectionText("hashtags");
    const gbp = sectionText("gbp_line");
    if (!caption) errors.push(`${file}: Carousel ${d.id}: no Caption found after the slides.`);
    if (!hashtags) errors.push(`${file}: Carousel ${d.id}: no Hashtags found after the slides.`);
    if (!gbp) errors.push(`${file}: Carousel ${d.id}: no GBP repurpose line found after the slides.`);

    carousels.push({
      id: d.id,
      title: finalTitle,
      declared_slide_count: declared,
      pairs_with: pairsWith,
      job_id: d.jobId,
      slides,
      caption,
      hashtags,
      gbp_line: gbp,
      errors,
      warnings,
      line: d.line,
    });
  }

  if (carousels.length === 0) {
    fileErrors.push(
      `${file}: no carousel found. Expected a heading like: ## Carousel 1 — "Title" (6 slides).`,
    );
  }

  return { file, carousels, errors: fileErrors, warnings: fileWarnings };
}
