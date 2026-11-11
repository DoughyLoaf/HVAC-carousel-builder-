import path from "node:path";

// Everything lives on this machine. No cloud storage, no API keys.
const root = process.env.CAROUSEL_ROOT_DIR || process.cwd();

export const ROOT_DIR = root;
/** Source Markdown files. Read-only for the app, except content/new/. */
export const CONTENT_DIR = process.env.CAROUSEL_CONTENT_DIR || path.join(root, "content");
/** Build-ready files the app writes when Austin creates a new carousel. */
export const CREATED_DIR = path.join(CONTENT_DIR, "new");
export const DATA_DIR = process.env.CAROUSEL_DATA_DIR || path.join(root, "data");
export const PHOTOS_DIR = path.join(DATA_DIR, "photos");
export const STATE_FILE = path.join(DATA_DIR, "state.json");
export const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
export const EXPORTS_DIR = process.env.CAROUSEL_EXPORTS_DIR || path.join(root, "exports");
export const REGISTRY_FILE =
  process.env.CAROUSEL_REGISTRY_FILE || path.join(root, "carousel-registry.json");
