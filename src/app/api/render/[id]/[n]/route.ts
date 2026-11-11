import { fail, parseId } from "@/lib/http";
import { photoPath } from "@/lib/photos";
import { renderSlide, resizeJpeg } from "@/lib/render";
import { getDetail } from "@/lib/service";
import { slideState } from "@/lib/store";

export const dynamic = "force-dynamic";

// Live preview. Uses the same plan and the same renderer as the export, so
// the preview is the slide exactly as it will export.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; n: string }> },
) {
  const p = await params;
  const id = parseId(p.id);
  const n = parseId(p.n);
  if (id === null || n === null) return fail("Unknown slide.", 404);
  const d = await getDetail(id);
  const sp = d?.plan.slides.find((s) => s.number === n);
  if (!d || !sp) return fail("Unknown slide.", 404);
  if (!sp.text) return fail("This slide has no on-screen text in the source file.", 409);

  const q = new URL(req.url).searchParams;
  const st = slideState(d.state, n);
  const num = (k: string, dflt: number) => {
    const v = Number(q.get(k));
    return q.has(k) && Number.isFinite(v) ? v : dflt;
  };
  const crop = {
    x: Math.min(1, Math.max(0, num("x", st.crop.x))),
    y: Math.min(1, Math.max(0, num("y", st.crop.y))),
    zoom: Math.min(4, Math.max(1, num("zoom", st.crop.zoom))),
  };

  try {
    let jpg = await renderSlide({
      mode: sp.mode,
      text: sp.text,
      small_line: sp.small_line,
      photo_path: sp.photo_used ? photoPath(sp.photo_used) : null,
      crop,
      settings: d.settings,
    });
    const w = Number(q.get("w"));
    if (Number.isFinite(w) && w >= 60 && w < 1080) jpg = await resizeJpeg(jpg, Math.round(w));
    return new Response(new Uint8Array(jpg), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return fail(`Could not render slide ${n}: ${(e as Error).message}`, 500);
  }
}
