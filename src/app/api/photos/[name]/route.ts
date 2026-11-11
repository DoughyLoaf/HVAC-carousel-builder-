import fs from "node:fs";
import sharp from "sharp";
import { fail, json } from "@/lib/http";
import { deletePhoto, listPhotos, PhotoError, photoPath } from "@/lib/photos";
import { loadState } from "@/lib/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ name: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { name } = await params;
  let file: string;
  try {
    file = photoPath(decodeURIComponent(name));
  } catch (e) {
    return fail((e as PhotoError).message, 400);
  }
  if (!fs.existsSync(file)) return fail("Photo not found.", 404);
  const w = Math.min(1200, Math.max(60, Number(new URL(req.url).searchParams.get("w")) || 320));
  const jpg = await sharp(file).rotate().resize({ width: w, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
  return new Response(new Uint8Array(jpg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=60" },
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { name } = await params;
  const filename = decodeURIComponent(name);
  // Refuse to remove a photo that a slot still points at.
  const state = loadState();
  const used: string[] = [];
  for (const [cid, cs] of Object.entries(state.carousels)) {
    for (const [n, st] of Object.entries(cs.slides ?? {})) {
      if (st.photo_filename === filename) used.push(`Carousel ${cid} slide ${n}`);
    }
  }
  if (used.length) {
    return fail(`${filename} is assigned to ${used.join(", ")}. Remove it from those slots first.`, 409);
  }
  try {
    deletePhoto(filename);
  } catch (e) {
    return fail((e as Error).message, 400);
  }
  return json({ photos: await listPhotos() });
}
