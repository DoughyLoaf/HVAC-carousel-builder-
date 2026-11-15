/** True when a browser request comes from this site's own pages (or carries no Origin at all). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Reads a JSON body up to `maxBytes`. Null when it is too large or not JSON. */
export async function readJson(request: Request, maxBytes = 20_000): Promise<unknown | null> {
  const raw = await request.text();
  if (raw.length > maxBytes) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
