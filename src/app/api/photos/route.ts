import { fail, json } from "@/lib/http";
import { listPhotos, PhotoError, savePhoto } from "@/lib/photos";
import type { PhotoInfo } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return json({ photos: await listPhotos() });
}

// Upload stills into the local selects library. Files stay on this machine.
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Upload could not be read.");
  }
  const saved: PhotoInfo[] = [];
  const rejected: { filename: string; reason: string }[] = [];
  for (const entry of form.getAll("photos")) {
    if (typeof entry === "string") continue;
    try {
      saved.push(await savePhoto(entry.name, Buffer.from(await entry.arrayBuffer())));
    } catch (e) {
      rejected.push({
        filename: entry.name,
        reason: e instanceof PhotoError ? e.message : `Could not save: ${(e as Error).message}`,
      });
    }
  }
  if (!saved.length && !rejected.length) return fail("No photos were sent.");
  return json({ saved, rejected, photos: await listPhotos() }, saved.length ? 200 : 400);
}
