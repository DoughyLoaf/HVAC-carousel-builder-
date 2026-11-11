import { ExportBlocked, exportCanvaCsv } from "@/lib/exporter";
import { fail, parseId } from "@/lib/http";
import { pad2 } from "@/lib/slug";

export const dynamic = "force-dynamic";

// Secondary export: a CSV for Canva Bulk Create. Same gates as the main export.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) return fail("Unknown carousel.", 404);
  try {
    const { csv } = await exportCanvaCsv(id);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="carousel-${pad2(id)}-canva-bulk-create.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof ExportBlocked) return fail("Export blocked.", 409, { reasons: e.reasons });
    return fail(`Export failed: ${(e as Error).message}`, 500);
  }
}
