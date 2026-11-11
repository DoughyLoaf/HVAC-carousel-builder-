// Shared types. Nothing in here holds copy — copy only ever comes from the
// Markdown files in content/ (parsed fresh from disk) or from what Austin types.

export type Permission = "Y" | "N" | "unconfirmed";

export const MISSING_COPY_MESSAGE =
  "Missing copy in source file — do not generate text.";

/** A slide exactly as the source Markdown file states it. */
export interface ParsedSlide {
  number: number;
  /** Anything after "Slide N" on the slide's header line, e.g. "Hook" or "CTA". */
  label: string | null;
  photo_needed: string | null;
  /** Exact words from the file. Multiple quoted segments become separate lines. */
  on_screen_text: string | null;
  small_line: string | null;
  fallback_text: string | null;
  /** True for inside-home photos. True unless the file explicitly says otherwise. */
  permission_required: boolean;
  permission_basis: string;
  /** Other labelled lines found in the slide block. Shown, never rendered. */
  extras: { label: string; value: string }[];
  /** Set when the slide has no on-screen text in the file. */
  blocked: string | null;
  warnings: string[];
  /** 1-based line in the source file where the slide starts. */
  line: number;
}

export interface ParsedCarousel {
  id: number;
  title: string;
  /** Slide count stated in the file's carousel header, if any. */
  declared_slide_count: number | null;
  pairs_with: string | null;
  job_id: string | null;
  slides: ParsedSlide[];
  caption: string | null;
  hashtags: string | null;
  gbp_line: string | null;
  /** Structural problems. Any error here stops the carousel from being built. */
  errors: string[];
  warnings: string[];
  line: number;
}

export interface ParsedFile {
  file: string;
  carousels: ParsedCarousel[];
  /** File-level structural problems. */
  errors: string[];
  warnings: string[];
}

export interface RegistryEntry {
  id: number;
  title: string;
  source_file: string | null;
  expected_slides?: number;
  blocked_reason?: string;
  note?: string;
  droppable_slides?: number[];
  natural_moment_slides?: number[];
  locked_slides?: number[];
  locked_note?: string;
}

export interface Registry {
  carousels: RegistryEntry[];
  suggested_order: number[][];
  outline_file: string;
  selects_map_files: string[];
  selects_checklist_file: string;
}

export type CarouselOrigin = "shoot1" | "content" | "created";

export type CarouselStatus =
  | "ready"
  | "blocked"
  | "source_missing"
  | "source_error"
  | "missing_copy";

/** A carousel as the app sees it: registry entry + parsed source. */
export interface Carousel {
  id: number;
  title: string;
  origin: CarouselOrigin;
  /** File name relative to the content directory, or null if none exists. */
  source_file: string | null;
  status: CarouselStatus;
  /** Human-readable reason for any status other than "ready". */
  status_reason: string | null;
  blocked_reason: string | null;
  note: string | null;
  parsed: ParsedCarousel | null;
  errors: string[];
  warnings: string[];
  droppable_slides: number[];
  natural_moment_slides: number[];
  locked_slides: number[];
  locked_note: string | null;
}

export interface Crop {
  /** 0..1 — where the crop window sits inside the spare width. 0.5 = centred. */
  x: number;
  y: number;
  /** >= 1. 1 = photo just covers the frame. */
  zoom: number;
}

export interface TextOverride {
  text: string;
  /** Source text at the moment of the edit, to log old/new and detect drift. */
  source_text_at_edit: string;
  edited_at: string;
}

export interface SlideState {
  photo_filename: string | null;
  crop: Crop;
  permission: Permission;
  /** null = follow the source file; false = Austin marked "not inside a home". */
  inside_home: boolean | null;
  override: TextOverride | null;
  dropped: boolean;
  /** Carousel 6 slide 5: Austin confirms the photo is a natural, unstaged moment. */
  natural_confirmed: boolean;
  /** Austin accepted that a small photo will be upscaled. */
  upscale_ack: boolean;
}

export interface CarouselState {
  job_id: string | null;
  slides: Record<string, SlideState>;
  /** Gate 4 confirmations, keyed by location, valid only for the exact text. */
  age_confirmations: Record<string, { text: string; confirmed_at: string }>;
}

export interface AppState {
  version: 1;
  carousels: Record<string, CarouselState>;
}

export interface Settings {
  /** Empty = system sans. Not invented: Austin fills in the brand font name. */
  font_family: string;
  overlay_opacity: number;
  text_size: number;
  text_bottom_margin: number;
  /** Neutral placeholder until Austin sets the template colour. */
  template_colour: string;
  /** Optional extra line on the plain brand slide. Empty by default. */
  brand_slide_text: string;
  /** PLACEHOLDER — empty until Austin fills it in. Never invented. */
  business_name: string;
  towns: string[];
}

export const EXPORT_WIDTH = 1080;
export const EXPORT_HEIGHT = 1350;
export const EXPORT_JPG_QUALITY = 90;

export interface PhotoInfo {
  filename: string;
  width: number;
  height: number;
  bytes: number;
}

export type RenderMode = "photo" | "text" | "brand";

export interface TextFlag {
  kind: "price" | "percentage" | "age";
  match: string;
  /** True when the match is the Reel 1 "22 years old" line specifically. */
  reel1_line: boolean;
}

export interface AgeOccurrence {
  /** Stable key: "slide-3-text", "slide-3-small", "caption", "gbp". */
  key: string;
  where: string;
  text: string;
  match: string;
  reel1_line: boolean;
  confirmed: boolean;
}

export interface SlidePlan {
  number: number;
  /** Position in the export after dropped slides are removed; null if dropped. */
  export_index: number | null;
  dropped: boolean;
  droppable: boolean;
  natural_moment_only: boolean;
  locked: boolean;
  is_cta: boolean;
  /** Text that will render. Null when the slide is blocked for missing copy. */
  text: string | null;
  small_line: string | null;
  edited_from_source: boolean;
  source_text: string | null;
  mode: RenderMode;
  /** Photo that will actually be used, after every gate. */
  photo_used: string | null;
  photo_assigned: string | null;
  /** Why the assigned/needed photo is not used, when it is not. */
  fallback_reason: string | null;
  permission_required: boolean;
  permission_basis: string;
  permission: Permission;
  /** e.g. "permission unconfirmed" — set whenever a photo was blocked by gate 2. */
  permission_flag: string | null;
  upscale: { factor: number; acknowledged: boolean } | null;
  blocked: string | null;
  /** Problems on this slide that stop the export. */
  errors: string[];
  /** Things the export will do that Austin should see first. */
  notices: string[];
}

export interface CarouselPlan {
  carousel_id: number;
  exportable: boolean;
  /** Everything that stops the export, across carousel and slides. */
  errors: string[];
  notices: string[];
  slides: SlidePlan[];
  age_occurrences: AgeOccurrence[];
  photos_missing: number;
}
