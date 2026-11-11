import { fail, json, parseId } from "@/lib/http";
import { getDetail } from "@/lib/service";
import { slideState, updateCarouselState } from "@/lib/store";

export const dynamic = "force-dynamic";

// Fills empty slots from file names recorded in a selects map — exact file
// name matches only. The app never guesses which photo fits a slot.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) return fail("Unknown carousel.", 404);
  const d = await getDetail(id);
  if (!d) return fail("Unknown carousel.", 404);
  if (d.carousel.status === "blocked") {
    return fail(`Carousel ${id} is blocked: ${d.carousel.blocked_reason}`, 409);
  }
  const library = new Set(d.photos.map((p) => p.filename));
  const matched: { slide: number; filename: string }[] = [];
  const not_in_library: { slide: number; filename: string }[] = [];
  updateCarouselState(id, (cs) => {
    for (const [slide, filename] of Object.entries(d.recorded_selects)) {
      const n = Number(slide);
      if (!d.plan.slides.some((s) => s.number === n)) continue;
      const st = slideState(cs, n);
      if (st.photo_filename) continue; // never replace a choice Austin made
      if (!library.has(filename)) {
        not_in_library.push({ slide: n, filename });
        continue;
      }
      st.photo_filename = filename;
      cs.slides[slide] = st;
      matched.push({ slide: n, filename });
    }
  });
  return json({ matched, not_in_library });
}
