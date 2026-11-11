// Loads carousels from the Markdown files on disk. Files are re-read on every
// request, so there is never a second stored copy of the copy that can drift.

import fs from "node:fs";
import path from "node:path";
import { CONTENT_DIR, CREATED_DIR } from "./paths";
import { parseBuildReady } from "./parse";
import { loadRegistry } from "./registry";
import type { Carousel, ParsedCarousel, ParsedFile, Registry, RegistryEntry } from "./types";

export interface SourceFileStatus {
  file: string;
  role: string;
  present: boolean;
  /** Build-ready copy files are required; outline / selects files are reference. */
  required: boolean;
}

export interface LoadedSources {
  carousels: Carousel[];
  registry: Registry;
  files: SourceFileStatus[];
  /** Problems that are not tied to one carousel (e.g. duplicate ids). */
  errors: string[];
  warnings: string[];
}

function readIfExists(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function listMarkdown(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && /\.md$/i.test(d.name))
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

const normTitle = (t: string) =>
  t.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9']+/g, " ").trim();

function fromRegistry(
  entry: RegistryEntry,
  parsedFiles: Map<string, ParsedFile | null>,
): Carousel {
  const base: Carousel = {
    id: entry.id,
    title: entry.title,
    origin: "shoot1",
    source_file: entry.source_file,
    status: "ready",
    status_reason: null,
    blocked_reason: entry.blocked_reason ?? null,
    note: entry.note ?? null,
    parsed: null,
    errors: [],
    warnings: [],
    droppable_slides: entry.droppable_slides ?? [],
    natural_moment_slides: entry.natural_moment_slides ?? [],
    locked_slides: entry.locked_slides ?? [],
    locked_note: entry.locked_note ?? null,
  };

  if (entry.blocked_reason) {
    return { ...base, status: "blocked", status_reason: entry.blocked_reason };
  }
  if (!entry.source_file) {
    return {
      ...base,
      status: "source_missing",
      status_reason: "No build-ready file is listed for this carousel in carousel-registry.json.",
    };
  }
  const pf = parsedFiles.get(entry.source_file);
  if (!pf) {
    return {
      ...base,
      status: "source_missing",
      status_reason: `Source file not found: content/${entry.source_file}. Copy the build-ready file into the content folder — the app will not write this copy itself.`,
    };
  }
  const parsed = pf.carousels.find((c) => c.id === entry.id) ?? null;
  if (!parsed) {
    const err = `${entry.source_file}: Carousel ${entry.id} was not found in this file. Expected a heading like: ## Carousel ${entry.id} — "${entry.title}".`;
    return {
      ...base,
      status: "source_error",
      status_reason: err,
      errors: [err, ...pf.errors],
    };
  }
  return finish({ ...base, parsed }, parsed, pf, entry);
}

function finish(
  base: Carousel,
  parsed: ParsedCarousel,
  pf: ParsedFile,
  entry: RegistryEntry | null,
): Carousel {
  const errors = [
    ...parsed.errors,
    ...pf.errors.filter((e) => e.includes(`Carousel ${parsed.id} `) || e.includes(`Carousel ${parsed.id}:`)),
  ];
  const warnings = [...parsed.warnings, ...parsed.slides.flatMap((s) => s.warnings)];

  if (entry) {
    if (entry.expected_slides && parsed.slides.length !== entry.expected_slides) {
      errors.push(
        `${pf.file}: Carousel ${parsed.id} should have ${entry.expected_slides} slides but ${parsed.slides.length} were found. Check slide ${Math.min(entry.expected_slides, parsed.slides.length) + 1}.`,
      );
    }
    if (normTitle(parsed.title) !== normTitle(entry.title)) {
      errors.push(
        `${pf.file}: Carousel ${parsed.id} is titled "${parsed.title}" in the file but "${entry.title}" was expected. Check that the right file is in place.`,
      );
    }
  }

  if (errors.length) {
    return {
      ...base,
      title: entry ? entry.title : parsed.title,
      parsed,
      status: "source_error",
      status_reason: errors[0],
      errors,
      warnings,
    };
  }
  const missing = parsed.slides.filter((s) => s.blocked);
  if (missing.length) {
    return {
      ...base,
      title: parsed.title,
      parsed,
      status: "missing_copy",
      status_reason: `${pf.file}: slide ${missing.map((s) => s.number).join(", ")} ${missing.length === 1 ? "has" : "have"} no on-screen text. Missing copy in source file — do not generate text.`,
      errors,
      warnings,
    };
  }
  return { ...base, title: parsed.title, parsed, errors, warnings };
}

export function loadSources(): LoadedSources {
  const registry = loadRegistry();
  const errors: string[] = [];
  const warnings: string[] = [];

  const rootFiles = listMarkdown(CONTENT_DIR);
  const createdFiles = listMarkdown(CREATED_DIR);

  const registryFiles = new Set(
    registry.carousels.map((c) => c.source_file).filter((f): f is string => !!f),
  );
  const referenceFiles = new Set([
    registry.outline_file,
    registry.selects_checklist_file,
    ...registry.selects_map_files,
    "README.md",
  ]);

  // Parse registry files plus any other build-ready file dropped in content/.
  const parsedFiles = new Map<string, ParsedFile | null>();
  for (const f of registryFiles) {
    const md = readIfExists(path.join(CONTENT_DIR, f));
    parsedFiles.set(f, md === null ? null : parseBuildReady(f, md));
  }
  const extraRoot = rootFiles.filter(
    (f) =>
      !registryFiles.has(f) &&
      !referenceFiles.has(f) &&
      /build-ready/i.test(f) &&
      !/selects-map|prompt/i.test(f),
  );
  for (const f of extraRoot) {
    parsedFiles.set(f, parseBuildReady(f, readIfExists(path.join(CONTENT_DIR, f)) ?? ""));
  }
  const createdParsed = new Map<string, ParsedFile>();
  for (const f of createdFiles) {
    const rel = `new/${f}`;
    createdParsed.set(rel, parseBuildReady(rel, readIfExists(path.join(CREATED_DIR, f)) ?? ""));
  }

  for (const pf of [...parsedFiles.values(), ...createdParsed.values()]) {
    if (pf) warnings.push(...pf.warnings);
  }

  const carousels: Carousel[] = registry.carousels.map((e) => fromRegistry(e, parsedFiles));
  const taken = new Map<number, string>(
    registry.carousels.map((e) => [e.id, e.source_file ?? "carousel-registry.json"]),
  );
  const registryById = new Map(registry.carousels.map((e) => [e.id, e]));

  // A registry file may hold carousels the registry maps elsewhere or blocks.
  for (const [f, pf] of parsedFiles) {
    if (!pf || !registryFiles.has(f)) continue;
    for (const pc of pf.carousels) {
      const entry = registryById.get(pc.id);
      if (entry?.blocked_reason) {
        warnings.push(
          `${f} contains Carousel ${pc.id}, but Carousel ${pc.id} stays blocked: ${entry.blocked_reason}`,
        );
      } else if (entry && entry.source_file !== f) {
        errors.push(
          `${f} contains Carousel ${pc.id}, but carousel-registry.json expects it in ${entry.source_file}. The copy in ${f} is ignored.`,
        );
      } else if (!entry) {
        addDiscovered(pc, pf, "content");
      }
    }
    // File-level errors not tied to a carousel must still be loud.
    for (const e of pf.errors) {
      if (!/Carousel \d+[ :]/.test(e)) errors.push(e);
    }
  }

  function addDiscovered(pc: ParsedCarousel, pf: ParsedFile, origin: "content" | "created") {
    const entry = registryById.get(pc.id);
    if (entry?.blocked_reason) {
      warnings.push(
        `${pf.file} contains Carousel ${pc.id}, but Carousel ${pc.id} stays blocked: ${entry.blocked_reason} (To unblock it, update carousel-registry.json.)`,
      );
      return;
    }
    if (taken.has(pc.id)) {
      errors.push(
        `${pf.file}: Carousel ${pc.id} is already defined by ${taken.get(pc.id)}. Give it a different number — this copy is ignored.`,
      );
      return;
    }
    taken.set(pc.id, pf.file);
    carousels.push(
      finish(
        {
          id: pc.id,
          title: pc.title,
          origin,
          source_file: pf.file,
          status: "ready",
          status_reason: null,
          blocked_reason: null,
          note: null,
          parsed: pc,
          errors: [],
          warnings: [],
          droppable_slides: [],
          natural_moment_slides: [],
          locked_slides: [],
          locked_note: null,
        },
        pc,
        pf,
        null,
      ),
    );
  }

  for (const f of extraRoot) {
    const pf = parsedFiles.get(f)!;
    if (pf.carousels.length === 0) errors.push(...pf.errors);
    else errors.push(...pf.errors.filter((e) => !/Carousel \d+[ :]/.test(e)));
    for (const pc of pf.carousels) addDiscovered(pc, pf, "content");
  }
  for (const [, pf] of createdParsed) {
    if (pf.carousels.length === 0) errors.push(...pf.errors);
    else errors.push(...pf.errors.filter((e) => !/Carousel \d+[ :]/.test(e)));
    for (const pc of pf.carousels) addDiscovered(pc, pf, "created");
  }

  carousels.sort((a, b) => a.id - b.id);

  const exists = (f: string) => !!f && fs.existsSync(path.join(CONTENT_DIR, f));
  const files: SourceFileStatus[] = [
    {
      file: registry.outline_file,
      role: "All 8 outlines (outline only — reference)",
      present: exists(registry.outline_file),
      required: false,
    },
    ...[...registryFiles].sort().map((f) => ({
      file: f,
      role: `Build-ready copy for Carousel ${registry.carousels
        .filter((c) => c.source_file === f)
        .map((c) => c.id)
        .join(" and ")}`,
      present: exists(f),
      required: true,
    })),
    ...registry.selects_map_files.map((f) => ({
      file: f,
      role: "Selects map — recorded file names can fill matching slots (reference)",
      present: exists(f),
      required: false,
    })),
    {
      file: registry.selects_checklist_file,
      role: "Nov 2 selects list the photos come from (reference)",
      present: exists(registry.selects_checklist_file),
      required: false,
    },
  ].filter((f) => f.file);

  return { carousels, registry, files, errors, warnings };
}

export function getCarousel(id: number): { carousel: Carousel | null; sources: LoadedSources } {
  const sources = loadSources();
  return { carousel: sources.carousels.find((c) => c.id === id) ?? null, sources };
}
