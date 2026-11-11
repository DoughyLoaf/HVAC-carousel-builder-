// Text checks behind gates 4 and 5. Pure functions — no I/O.
//
// The app never writes copy. These checks only decide whether text that a
// person wrote may be exported.

import type { TextFlag } from "./types";

const PRICE = /\$\s?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s?(?:dollars|bucks)\b|\bUSD\b/gi;
const PERCENT = /\d+(?:\.\d+)?\s?%|\b\d+(?:\.\d+)?\s?(?:percent|per cent)\b/gi;
const AGE = /(?:\b[\w-]+[\s-])?\b(?:years?|yrs?\.?)[\s-]old\b/gi;
const REEL1 = /\b(?:22|twenty[\s-]two)[\s-]?(?:years?|yrs?\.?)[\s-]old\b/i;

export function scanText(text: string | null | undefined): TextFlag[] {
  if (!text) return [];
  const flags: TextFlag[] = [];
  for (const m of text.matchAll(PRICE)) {
    flags.push({ kind: "price", match: m[0], reel1_line: false });
  }
  for (const m of text.matchAll(PERCENT)) {
    flags.push({ kind: "percentage", match: m[0], reel1_line: false });
  }
  for (const m of text.matchAll(AGE)) {
    flags.push({ kind: "age", match: m[0].trim(), reel1_line: REEL1.test(m[0]) });
  }
  return flags;
}

export function describeFlag(f: TextFlag): string {
  if (f.kind === "price") return `a price ("${f.match}")`;
  if (f.kind === "percentage") return `a percentage claim ("${f.match}")`;
  return f.reel1_line
    ? `the Reel 1 "22 years old" line ("${f.match}")`
    : `a "years old" age ("${f.match}")`;
}

/**
 * Text typed into the app (a manual edit or a new carousel) may not contain a
 * price or a percentage claim at all. Returns the reasons, empty if clean.
 */
export function typedTextProblems(text: string, opts: { allowAge: boolean }): string[] {
  return scanText(text)
    .filter((f) => (f.kind === "age" ? !opts.allowAge : true))
    .map((f) => describeFlag(f));
}
