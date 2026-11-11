import fs from "node:fs";
import path from "node:path";
import { fail, json } from "@/lib/http";
import {
  newCarouselFileName,
  validateNewCarousel,
  writeCarouselMarkdown,
  type NewCarouselInput,
} from "@/lib/markdown";
import { parseBuildReady } from "@/lib/parse";
import { CREATED_DIR } from "@/lib/paths";
import { listSummaries } from "@/lib/service";
import { loadSources } from "@/lib/sources";

export const dynamic = "force-dynamic";

export async function GET() {
  const { carousels, sources, photo_count } = await listSummaries();
  return json({
    carousels,
    files: sources.files,
    errors: sources.errors,
    warnings: sources.warnings,
    suggested_order: sources.registry.suggested_order,
    photo_count,
  });
}

/** Create a new carousel (Shoot 2 / future job). Every word comes from the form. */
export async function POST(req: Request) {
  let body: Partial<NewCarouselInput>;
  try {
    body = await req.json();
  } catch {
    return fail("Request was not valid JSON.");
  }
  const sources = loadSources();
  const id = Math.max(8, ...sources.carousels.map((c) => c.id)) + 1;
  const input: NewCarouselInput = {
    id,
    title: String(body.title ?? ""),
    pairs_with: body.pairs_with ? String(body.pairs_with) : null,
    slides: (Array.isArray(body.slides) ? body.slides : []).map((s) => ({
      photo_needed: String(s?.photo_needed ?? ""),
      on_screen_text: String(s?.on_screen_text ?? ""),
      small_line: s?.small_line ? String(s.small_line) : null,
      fallback_text: String(s?.fallback_text ?? ""),
      inside_home: s?.inside_home !== false,
    })),
    caption: String(body.caption ?? ""),
    hashtags: String(body.hashtags ?? ""),
    gbp_line: String(body.gbp_line ?? ""),
  };
  const problems = validateNewCarousel(input);
  if (problems.length) return fail("This carousel cannot be saved yet.", 400, { problems });

  const fileName = newCarouselFileName(id, input.title);
  const md = writeCarouselMarkdown(input, new Date().toISOString().slice(0, 10));

  // Read it back through the same parser before saving, so a saved file is
  // always one the app can open.
  const check = parseBuildReady(`new/${fileName}`, md);
  const parsed = check.carousels[0];
  const readBackProblems = [...check.errors, ...(parsed?.errors ?? [])];
  if (!parsed || readBackProblems.length || parsed.slides.some((s) => s.blocked)) {
    return fail("The saved file would not read back cleanly, so nothing was saved.", 400, {
      problems: readBackProblems.length ? readBackProblems : ["A slide lost its on-screen text when read back."],
    });
  }

  fs.mkdirSync(CREATED_DIR, { recursive: true });
  const dest = path.join(CREATED_DIR, fileName);
  if (fs.existsSync(dest)) return fail(`A file named ${fileName} already exists.`, 409);
  fs.writeFileSync(dest, md);
  return json({ id, file: `content/new/${fileName}` }, 201);
}
