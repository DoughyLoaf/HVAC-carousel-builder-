import { fail, json } from "@/lib/http";
import { loadSettings, saveSettings } from "@/lib/store";
import { EXPORT_HEIGHT, EXPORT_JPG_QUALITY, EXPORT_WIDTH } from "@/lib/types";

export const dynamic = "force-dynamic";

const fixed = { width: EXPORT_WIDTH, height: EXPORT_HEIGHT, jpg_quality: EXPORT_JPG_QUALITY };

export async function GET() {
  return json({ settings: loadSettings(), export: fixed });
}

export async function PUT(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Request was not valid JSON.");
  }
  return json({ settings: saveSettings(body), export: fixed });
}
