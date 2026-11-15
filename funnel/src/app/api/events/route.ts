import { sanitizeTouch } from "@/lib/attribution";
import { getDb } from "@/lib/db";
import { readJson, sameOrigin } from "@/lib/request";
import { clientIp, hashIp } from "@/lib/session";
import { countRecentTouchEventsFromIp, recordTouchEvent } from "@/lib/store";

/** Records a tap on a "Call CDA" button. Best effort: it must never get in the way of the call. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const body = (await readJson(request, 5000)) as { kind?: unknown; placement?: unknown; touch?: unknown } | null;
  if (!body || body.kind !== "call_click") return new Response(null, { status: 400 });
  try {
    const db = await getDb();
    const ipHash = hashIp(clientIp(request.headers));
    if ((await countRecentTouchEventsFromIp(db, ipHash, 60)) < 30) {
      await recordTouchEvent(db, "call_click", typeof body.placement === "string" ? body.placement : "", sanitizeTouch(body.touch), ipHash);
    }
  } catch (err) {
    console.error("[events] could not record a call tap:", err);
  }
  return new Response(null, { status: 204 });
}
