// Test helpers. All copy generated here is synthetic placeholder text
// ("Fixture ...") — it is never real carousel copy and never ships in content/.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

export interface FixtureSlide {
  text?: string | null;
  small?: string;
  fallback?: string;
  insideHome?: "yes" | "no";
}

export interface FixtureCarousel {
  id: number;
  title: string;
  slides: number | FixtureSlide[];
  pairs?: string;
  caption?: string;
}

export function fixtureMarkdown(carousels: FixtureCarousel[]): string {
  const L: string[] = ["# TEST FIXTURE — synthetic placeholder copy, not client copy", ""];
  for (const c of carousels) {
    const slides: FixtureSlide[] =
      typeof c.slides === "number" ? Array.from({ length: c.slides }, () => ({})) : c.slides;
    L.push(`## Carousel ${c.id} — "${c.title}" (${slides.length} slides${c.pairs ? `, pairs with ${c.pairs}` : ""})`, "");
    slides.forEach((s, i) => {
      const n = i + 1;
      const last = n === slides.length;
      L.push(`### Slide ${n}${last ? " — CTA" : ""}`, "");
      L.push(`- **Photo needed:** Fixture photo for carousel ${c.id} slide ${n}`);
      if (s.insideHome) L.push(`- **Inside home:** ${s.insideHome}`);
      if (s.text !== null) L.push(`- **On-screen text:** "${s.text ?? `Fixture C${c.id} S${n} text.`}"`);
      if (s.small) L.push(`- **Small line:** "${s.small}"`);
      L.push(`- **Fallback:** ${s.fallback ?? "plain text slide, same words, no photo"}`, "");
    });
    L.push("### Caption", "", c.caption ?? `Fixture caption for carousel ${c.id}.\n\nSecond fixture paragraph.`, "");
    L.push("### Hashtags", "", `#fixture${c.id} #fixturetag`, "");
    L.push("### GBP repurpose", "", `Fixture GBP line for carousel ${c.id}.`, "", "---", "");
  }
  return L.join("\n");
}

export const SHOOT1 = {
  c1: { id: 1, title: "Sized wrong, not just old", slides: 6, pairs: "Reel 1" },
  c2: { id: 2, title: "Old furnace out. New furnace in. One day.", slides: 7 },
  c4: { id: 4, title: "No heat? Here's what we check first", slides: 7, pairs: "Reel 2" },
  c5: { id: 5, title: "3 signs your furnace won't make it through winter", slides: 6 },
  c6: { id: 6, title: "Meet the crew", slides: 6 },
  c7: { id: 7, title: "New construction: we build it, then we maintain it", slides: 6 },
} satisfies Record<string, FixtureCarousel>;

export interface FixtureRoot {
  root: string;
  content: string;
  write: (file: string, carousels: FixtureCarousel[]) => void;
  writeRaw: (file: string, text: string) => void;
  cleanup: () => void;
}

/** A throwaway app root with the real registry and (optionally) fixture copy files. */
export function makeRoot(opts: { withShoot1?: boolean } = {}): FixtureRoot {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "carousel-test-"));
  const content = path.join(root, "content");
  fs.mkdirSync(content, { recursive: true });
  fs.copyFileSync(path.join(__dirname, "..", "carousel-registry.json"), path.join(root, "carousel-registry.json"));
  const writeRaw = (file: string, text: string) => {
    const dest = path.join(content, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, text);
  };
  const write = (file: string, carousels: FixtureCarousel[]) => writeRaw(file, fixtureMarkdown(carousels));
  if (opts.withShoot1) {
    write("cda-hvac-carousels-1-2-build-ready.md", [SHOOT1.c1, SHOOT1.c2]);
    write("cda-hvac-carousels-4-5-build-ready.md", [SHOOT1.c4, SHOOT1.c5]);
    write("cda-hvac-carousels-6-7-build-ready.md", [SHOOT1.c6, SHOOT1.c7]);
  }
  return { root, content, write, writeRaw, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

export function useRoot(root: string) {
  process.env.CAROUSEL_ROOT_DIR = root;
  delete process.env.CAROUSEL_CONTENT_DIR;
  delete process.env.CAROUSEL_DATA_DIR;
  delete process.env.CAROUSEL_EXPORTS_DIR;
  delete process.env.CAROUSEL_REGISTRY_FILE;
}

/** A solid-colour JPG, so tests can tell a photo slide from a text slide by pixel. */
export async function solidJpg(width: number, height: number, colour: string): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: colour } }).jpeg({ quality: 95 }).toBuffer();
}

export async function pixel(jpg: Buffer, x: number, y: number): Promise<[number, number, number]> {
  const { data } = await sharp(jpg).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  return [data[0], data[1], data[2]];
}
