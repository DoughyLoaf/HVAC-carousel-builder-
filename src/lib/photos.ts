// The local selects library. Photos never leave this machine.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PHOTOS_DIR } from "./paths";
import type { PhotoInfo } from "./types";

const ALLOWED = /\.(jpe?g|png|webp|tiff?)$/i;
const VIDEO = /\.(mp4|mov|m4v|avi|mkv|webm)$/i;

export class PhotoError extends Error {}

const cache = new Map<string, { key: string; info: PhotoInfo }>();

export function safeName(name: string): string {
  const base = path.basename(String(name).replace(/\\/g, "/"));
  if (!base || base.startsWith(".") || /[\u0000-\u001f<>:"|?*]/.test(base)) {
    throw new PhotoError(`"${name}" is not a usable file name.`);
  }
  return base;
}

export function photoPath(name: string): string {
  return path.join(PHOTOS_DIR, safeName(name));
}

async function infoFor(filename: string): Promise<PhotoInfo | null> {
  const file = path.join(PHOTOS_DIR, filename);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return null;
  }
  const key = `${stat.size}:${stat.mtimeMs}`;
  const hit = cache.get(filename);
  if (hit && hit.key === key) return hit.info;
  try {
    const meta = await sharp(file).metadata();
    let w = meta.width ?? 0;
    let h = meta.height ?? 0;
    if ((meta.orientation ?? 1) >= 5) [w, h] = [h, w]; // EXIF says rotated 90°
    const info = { filename, width: w, height: h, bytes: stat.size };
    cache.set(filename, { key, info });
    return info;
  } catch {
    return null;
  }
}

export async function listPhotos(): Promise<PhotoInfo[]> {
  let names: string[];
  try {
    names = fs.readdirSync(PHOTOS_DIR).filter((n) => ALLOWED.test(n) && !n.startsWith("."));
  } catch {
    return []; // Empty library on first run is normal.
  }
  const infos = await Promise.all(names.sort().map(infoFor));
  return infos.filter((i): i is PhotoInfo => !!i);
}

export async function photoMap(): Promise<Map<string, PhotoInfo>> {
  return new Map((await listPhotos()).map((p) => [p.filename, p]));
}

const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

/** Save an uploaded photo under its exact original file name. */
export async function savePhoto(name: string, data: Buffer): Promise<PhotoInfo> {
  const filename = safeName(name);
  if (VIDEO.test(filename)) {
    throw new PhotoError(
      `${filename} is a video. This tool builds from stills only — it does not turn clips into slides.`,
    );
  }
  if (/\.(heic|heif)$/i.test(filename)) {
    throw new PhotoError(`${filename} is HEIC. Export it as a JPG first (same file name), then upload.`);
  }
  if (!ALLOWED.test(filename)) {
    throw new PhotoError(`${filename}: only JPG, PNG, WebP or TIFF stills can be used.`);
  }
  try {
    const meta = await sharp(data).metadata();
    if (!meta.width || !meta.height) throw new Error("no dimensions");
  } catch {
    throw new PhotoError(`${filename} could not be read as an image.`);
  }
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  const dest = path.join(PHOTOS_DIR, filename);
  if (fs.existsSync(dest)) {
    if (sha(fs.readFileSync(dest)) !== sha(data)) {
      throw new PhotoError(
        `A different photo named ${filename} is already in the library. File names are recorded per slot, so each must be unique — rename one and upload again.`,
      );
    }
  } else {
    fs.writeFileSync(dest, data);
  }
  const info = await infoFor(filename);
  if (!info) throw new PhotoError(`${filename} could not be read after saving.`);
  return info;
}

export function deletePhoto(name: string) {
  const file = photoPath(name);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  cache.delete(safeName(name));
}
