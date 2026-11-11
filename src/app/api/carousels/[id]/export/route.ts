import { ExportBlocked, exportCarousel } from "@/lib/exporter";
import { fail, json, parseId } from "@/lib/http";

export const dynamic = "force-dynamic";

// Writes files to the local exports folder. That is all it does:
// no posting, no scheduling, no sending.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) return fail("Unknown carousel.", 404);
  try {
    const result = await exportCarousel(id);
    return json(result);
  } catch (e) {
    if (e instanceof ExportBlocked) {
      return fail("Export blocked.", 409, { reasons: e.reasons });
    }
    return fail(`Export failed: ${(e as Error).message}`, 500);
  }
}
