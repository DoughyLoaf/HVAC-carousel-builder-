import { fail, parseId } from "@/lib/http";
import { writeSelectsMap } from "@/lib/selectsMap";
import { getDetail } from "@/lib/service";
import { pad2 } from "@/lib/slug";

export const dynamic = "force-dynamic";

// The tick sheet for this carousel as it stands now (before export).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) return fail("Unknown carousel.", 404);
  const d = await getDetail(id);
  if (!d) return fail("Unknown carousel.", 404);
  if (d.carousel.status === "blocked") {
    return fail(`Carousel ${id} is blocked: ${d.carousel.blocked_reason}`, 409);
  }
  if (!d.carousel.parsed || !d.plan.slides.length) {
    return fail(d.carousel.status_reason ?? "This carousel has no readable source file.", 409);
  }
  const md = writeSelectsMap(d.carousel, d.carousel.parsed, d.plan, {
    date: new Date().toISOString().slice(0, 10),
    exported: false,
    selects_source:
        d.carousel.origin === "shoot1" && d.sources.registry.selects_checklist_file
          ? d.sources.registry.selects_checklist_file
          : "the selects for this shoot / job",
  });
  return new Response(md + "\n", {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="carousel-${pad2(id)}-selects-map.md"`,
      "Cache-Control": "no-store",
    },
  });
}
