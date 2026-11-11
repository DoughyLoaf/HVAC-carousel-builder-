// Local JSON storage for slot assignments and template settings.
// Holds layout decisions only — never a copy of the carousel copy
// (the one exception is a manual text edit, which is logged with old and new text).

import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, SETTINGS_FILE, STATE_FILE } from "./paths";
import type { AppState, CarouselState, Settings, SlideState } from "./types";

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error(`Could not read ${file}: ${(e as Error).message}`);
  }
}

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

export const DEFAULT_SETTINGS: Settings = {
  font_family: "",
  overlay_opacity: 0.7,
  text_size: 64,
  text_bottom_margin: 96,
  template_colour: "#1C1F24",
  brand_slide_text: "",
  business_name: "",
  towns: ["Coeur d'Alene", "Post Falls", "Hayden", "Spokane Valley"],
};

const clamp = (n: unknown, lo: number, hi: number, dflt: number) => {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
};

export function sanitizeSettings(input: Partial<Settings> | null | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(input ?? {}) };
  const colour = /^#[0-9a-fA-F]{6}$/.test(String(s.template_colour))
    ? String(s.template_colour)
    : DEFAULT_SETTINGS.template_colour;
  return {
    font_family: String(s.font_family ?? "").replace(/[<>&"]/g, "").trim().slice(0, 80),
    overlay_opacity: clamp(s.overlay_opacity, 0, 1, DEFAULT_SETTINGS.overlay_opacity),
    text_size: Math.round(clamp(s.text_size, 32, 120, DEFAULT_SETTINGS.text_size)),
    text_bottom_margin: Math.round(clamp(s.text_bottom_margin, 40, 400, DEFAULT_SETTINGS.text_bottom_margin)),
    template_colour: colour,
    brand_slide_text: String(s.brand_slide_text ?? "").trim().slice(0, 200),
    business_name: String(s.business_name ?? "").trim().slice(0, 80),
    towns: (Array.isArray(s.towns) ? s.towns : DEFAULT_SETTINGS.towns)
      .map((t) => String(t).trim())
      .filter(Boolean)
      .slice(0, 12),
  };
}

export function loadSettings(): Settings {
  return sanitizeSettings(readJson<Partial<Settings>>(SETTINGS_FILE));
}

export function saveSettings(input: Partial<Settings>): Settings {
  const s = sanitizeSettings({ ...loadSettings(), ...input });
  writeJson(SETTINGS_FILE, s);
  return s;
}

export function loadState(): AppState {
  const s = readJson<AppState>(STATE_FILE);
  return s && s.carousels ? s : { version: 1, carousels: {} };
}

export function saveState(state: AppState) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  writeJson(STATE_FILE, state);
}

export function defaultSlideState(): SlideState {
  return {
    photo_filename: null,
    crop: { x: 0.5, y: 0.5, zoom: 1 },
    permission: "unconfirmed",
    inside_home: null,
    override: null,
    dropped: false,
    natural_confirmed: false,
    upscale_ack: false,
  };
}

export function carouselState(state: AppState, id: number): CarouselState {
  return state.carousels[String(id)] ?? { job_id: null, slides: {}, age_confirmations: {} };
}

export function slideState(cs: CarouselState, n: number): SlideState {
  return { ...defaultSlideState(), ...(cs.slides[String(n)] ?? {}) };
}

export function updateCarouselState(
  id: number,
  fn: (cs: CarouselState) => void,
): CarouselState {
  const state = loadState();
  const cs = carouselState(state, id);
  cs.slides ??= {};
  cs.age_confirmations ??= {};
  fn(cs);
  state.carousels[String(id)] = cs;
  saveState(state);
  return cs;
}
