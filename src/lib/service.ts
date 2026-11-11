// Puts sources, local state, settings and the photo library together.

import fs from "node:fs";
import path from "node:path";
import { CONTENT_DIR } from "./paths";
import { photoMap } from "./photos";
import { computePlan } from "./plan";
import { measureFit } from "./render";
import { parseSelectsMap } from "./selectsMap";
import { getCarousel, loadSources, type LoadedSources } from "./sources";
import { carouselState, loadSettings, loadState } from "./store";
import type {
  Carousel,
  CarouselPlan,
  CarouselState,
  PhotoInfo,
  Settings,
} from "./types";

export interface CarouselDetail {
  carousel: Carousel;
  state: CarouselState;
  plan: CarouselPlan;
  settings: Settings;
  photos: PhotoInfo[];
  /** File names recorded for this carousel in a hand-written selects map. */
  recorded_selects: Record<string, string>;
  sources: LoadedSources;
}

export async function buildPlan(
  carousel: Carousel,
  cs: CarouselState,
  settings: Settings,
  photos: Map<string, PhotoInfo>,
): Promise<CarouselPlan> {
  const plan = computePlan(carousel, cs, settings, photos);
  // Text that does not fit the fixed template stops the export.
  for (const sp of plan.slides) {
    if (sp.dropped || !sp.text) continue;
    const fit = await measureFit(sp.text, sp.small_line, sp.mode, settings);
    if (!fit.fits) {
      const msg = `Slide ${sp.number}: the text does not fit the template at text size ${settings.text_size}. Lower the text size or bottom margin in Settings — the words are not shortened for you.`;
      sp.errors.push(msg);
      plan.errors.push(msg);
    }
  }
  plan.exportable = plan.errors.length === 0;
  return plan;
}

export function recordedSelects(sources: LoadedSources, id: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of sources.registry.selects_map_files) {
    let md: string;
    try {
      md = fs.readFileSync(path.join(CONTENT_DIR, f), "utf8");
    } catch {
      continue;
    }
    const forCarousel = parseSelectsMap(md).get(id);
    if (forCarousel) for (const [n, name] of forCarousel) out[String(n)] ??= name;
  }
  return out;
}

export async function getDetail(id: number): Promise<CarouselDetail | null> {
  const { carousel, sources } = getCarousel(id);
  if (!carousel) return null;
  const settings = loadSettings();
  const state = carouselState(loadState(), id);
  const photos = await photoMap();
  const plan = await buildPlan(carousel, state, settings, photos);
  return {
    carousel,
    state,
    plan,
    settings,
    photos: [...photos.values()],
    recorded_selects: recordedSelects(sources, id),
    sources,
  };
}

export interface CarouselSummary {
  id: number;
  title: string;
  origin: Carousel["origin"];
  status: Carousel["status"];
  status_reason: string | null;
  source_file: string | null;
  slide_count: number | null;
  pairs_with: string | null;
  photos_missing: number;
  exportable: boolean;
  problem_count: number;
}

export async function listSummaries(): Promise<{
  carousels: CarouselSummary[];
  sources: LoadedSources;
  photo_count: number;
}> {
  const sources = loadSources();
  const settings = loadSettings();
  const state = loadState();
  const photos = await photoMap();
  const carousels = sources.carousels.map((c) => {
    const plan = computePlan(c, carouselState(state, c.id), settings, photos);
    return {
      id: c.id,
      title: c.title,
      origin: c.origin,
      status: c.status,
      status_reason: c.status_reason,
      source_file: c.source_file,
      slide_count: c.status === "blocked" ? null : (c.parsed?.slides.length ?? null),
      pairs_with: c.status === "blocked" ? null : (c.parsed?.pairs_with ?? null),
      photos_missing: plan.photos_missing,
      exportable: plan.exportable,
      problem_count: plan.errors.length,
    };
  });
  return { carousels, sources, photo_count: photos.size };
}
