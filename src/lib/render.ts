// The one fixed template, rendered server-side with Sharp.
// Every slide is 1080 x 1350 (4:5). Same font, size and text position on every
// slide. The preview and the export both come from this function.

import sharp, { type OverlayOptions, type Sharp } from "sharp";
import {
  EXPORT_HEIGHT as H,
  EXPORT_JPG_QUALITY,
  EXPORT_WIDTH as W,
  type Crop,
  type RenderMode,
  type Settings,
} from "./types";

export const SIDE_MARGIN = 72;
const TEXT_WIDTH = W - SIDE_MARGIN * 2;
const SMALL_RATIO = 0.55;
const LINE_GAP = 28;
const TOP_SAFE = 72;
/** Space kept for the business name block at the top of a brand slide. */
const BRAND_BLOCK_BOTTOM = 470;

export interface RenderInput {
  mode: RenderMode;
  text: string;
  small_line: string | null;
  /** Absolute path of the photo. Required when mode is "photo". */
  photo_path?: string | null;
  crop?: Crop;
  settings: Settings;
}

interface TextImg {
  data: Buffer;
  width: number;
  height: number;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function fontFamily(settings: Settings): string {
  // Empty setting = system sans. No brand font is assumed.
  const f = settings.font_family.trim();
  return f ? `${f}, sans-serif` : "sans-serif";
}

async function textImg(
  text: string,
  opts: { family: string; size: number; bold: boolean; alpha?: number },
): Promise<TextImg> {
  const alpha = Math.round((opts.alpha ?? 1) * 65535);
  const markup =
    `<span foreground="#FFFFFF" alpha="${Math.max(1, alpha)}" font_family="${esc(opts.family).replace(/"/g, "")}" ` +
    `font_weight="${opts.bold ? "bold" : "normal"}" font_size="${Math.round(opts.size * 1024)}">` +
    `${esc(text)}</span>`;
  const { data, info } = await sharp({
    text: { text: markup, width: TEXT_WIDTH, rgba: true, dpi: 72, wrap: "word", align: "left" },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

interface TextBlock {
  main: TextImg;
  small: TextImg | null;
  /** Height of main + gap + small. */
  height: number;
  /** Y of the top of the main line on the canvas. */
  top: number;
}

async function layoutText(
  text: string,
  small: string | null,
  settings: Settings,
): Promise<TextBlock> {
  const family = fontFamily(settings);
  const main = await textImg(text, { family, size: settings.text_size, bold: true });
  const smallImg = small
    ? await textImg(small, {
        family,
        size: Math.round(settings.text_size * SMALL_RATIO),
        bold: false,
        alpha: 0.92,
      })
    : null;
  const height = main.height + (smallImg ? LINE_GAP + smallImg.height : 0);
  const top = H - settings.text_bottom_margin - height;
  return { main, small: smallImg, height, top };
}

/** Does this text fit the template at the current settings? */
export async function measureFit(
  text: string,
  small: string | null,
  mode: RenderMode,
  settings: Settings,
): Promise<{ fits: boolean; height: number }> {
  const b = await layoutText(text, small, settings);
  const limit = mode === "brand" ? BRAND_BLOCK_BOTTOM : TOP_SAFE;
  return { fits: b.top >= limit, height: b.height };
}

/** Source rectangle to extract so the photo covers the 4:5 frame without distortion. */
export function cropRect(
  photo: { width: number; height: number },
  crop: Crop,
): { left: number; top: number; width: number; height: number; scale: number } {
  const zoom = Math.max(1, crop.zoom || 1);
  const scale = Math.max(W / photo.width, H / photo.height) * zoom;
  const w = Math.min(photo.width, Math.max(1, Math.round(W / scale)));
  const h = Math.min(photo.height, Math.max(1, Math.round(H / scale)));
  const x = Math.min(1, Math.max(0, crop.x ?? 0.5));
  const y = Math.min(1, Math.max(0, crop.y ?? 0.5));
  return {
    left: Math.round((photo.width - w) * x),
    top: Math.round((photo.height - h) * y),
    width: w,
    height: h,
    scale,
  };
}

function gradientSvg(textTop: number, opacity: number): Buffer {
  // Eased ramp: fully clear above the text, close to full strength where the
  // text starts, with no visible edge where the gradient begins.
  const start = Math.max(0, textTop - 420);
  const span = H - start;
  const solidAt = Math.min(0.95, Math.max(0.1, (textTop - 30 - start) / span));
  const stops: string[] = [];
  const STEPS = 10;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const eased = t * t * (3 - 2 * t); // smoothstep
    stops.push(
      `<stop offset="${(t * solidAt).toFixed(4)}" stop-color="#000" stop-opacity="${(eased * opacity * 0.85).toFixed(4)}"/>`,
    );
  }
  stops.push(`<stop offset="1" stop-color="#000" stop-opacity="${opacity.toFixed(4)}"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${stops.join("")}</linearGradient></defs>
  <rect x="0" y="${start}" width="${W}" height="${span}" fill="url(#g)"/>
</svg>`;
  return Buffer.from(svg);
}

export async function renderSlide(input: RenderInput): Promise<Buffer> {
  const { settings } = input;
  const block = await layoutText(input.text, input.small_line, settings);
  const layers: OverlayOptions[] = [];

  let base: Sharp;
  if (input.mode === "photo") {
    if (!input.photo_path) throw new Error("Photo slide without a photo path.");
    const meta = await sharp(input.photo_path).metadata();
    const size = meta.autoOrient ?? { width: meta.width!, height: meta.height! };
    const rect = cropRect(size, input.crop ?? { x: 0.5, y: 0.5, zoom: 1 });
    // Auto-orient, cut the 4:5 window, then size to the canvas. The window is
    // already 4:5, so nothing is stretched or squished.
    const photo = await sharp(input.photo_path)
      .rotate()
      .extract({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
      .resize(W, H, { fit: "fill", kernel: "lanczos3" })
      .removeAlpha()
      .toColourspace("srgb")
      .png({ compressionLevel: 1 })
      .toBuffer();
    base = sharp(photo);
    layers.push({ input: gradientSvg(block.top, settings.overlay_opacity), left: 0, top: 0 });
  } else {
    // Text-slide fallback / brand slide: plain template colour, no photo.
    base = sharp({
      create: { width: W, height: H, channels: 3, background: settings.template_colour },
    });
  }

  if (input.mode === "brand") {
    const family = fontFamily(settings);
    let y = 120;
    const name = settings.business_name.trim();
    if (name) {
      const img = await textImg(name, {
        family,
        size: Math.round(settings.text_size * 0.8),
        bold: true,
      });
      layers.push({ input: img.data, left: SIDE_MARGIN, top: y });
      y += img.height + 26;
    }
    if (settings.brand_slide_text.trim()) {
      const img = await textImg(settings.brand_slide_text.trim(), {
        family,
        size: Math.round(settings.text_size * 0.5),
        bold: false,
        alpha: 0.92,
      });
      layers.push({ input: img.data, left: SIDE_MARGIN, top: y });
      y += img.height + 22;
    }
    if (settings.towns.length) {
      const img = await textImg(settings.towns.join("  ·  "), {
        family,
        size: Math.round(settings.text_size * 0.4),
        bold: false,
        alpha: 0.72,
      });
      layers.push({ input: img.data, left: SIDE_MARGIN, top: y });
    }
  }

  // Text that is too long is stopped by the export check; the preview still
  // has to draw, so clip anything that would run off the canvas.
  const place = async (img: TextImg, top: number) => {
    const t = Math.max(0, Math.min(H - 1, top));
    const room = H - t;
    const data =
      img.height > room
        ? await sharp(img.data).extract({ left: 0, top: 0, width: img.width, height: room }).png().toBuffer()
        : img.data;
    layers.push({ input: data, left: SIDE_MARGIN, top: t });
  };
  await place(block.main, block.top);
  if (block.small) await place(block.small, block.top + block.main.height + LINE_GAP);

  return base
    .composite(layers)
    .jpeg({ quality: EXPORT_JPG_QUALITY, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

export async function resizeJpeg(jpg: Buffer, width: number): Promise<Buffer> {
  return sharp(jpg).resize({ width }).jpeg({ quality: 82 }).toBuffer();
}
