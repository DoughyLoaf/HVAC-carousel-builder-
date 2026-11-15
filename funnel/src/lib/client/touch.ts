import { EMPTY_TOUCH, hasSignal, sanitizeTouch, touchFromUrl, type Touch } from "@/lib/attribution";

const FIRST_KEY = "cda.firstTouch";
const LAST_KEY = "cda.lastTouch";
const FIRST_TOUCH_DAYS = 90;

function read(storage: Storage | undefined, key: string): Touch | null {
  try {
    const raw = storage?.getItem(key);
    return raw ? sanitizeTouch(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function write(storage: Storage | undefined, key: string, touch: Touch): void {
  try {
    storage?.setItem(key, JSON.stringify(touch));
  } catch {
    // Private windows and blocked storage: attribution degrades, the form still works.
  }
}

function storages(): { local?: Storage; session?: Storage } {
  try {
    return { local: window.localStorage, session: window.sessionStorage };
  } catch {
    return {};
  }
}

let memory: { last: Touch; first: Touch | null } | null = null;

/**
 * Records this page view's attribution and returns the pair sent with a lead:
 *  - last:  the visit that is converting (kept for the browser session, and
 *           not overwritten by a later untagged page view),
 *  - first: the first visit seen from this browser in the last 90 days.
 * Uses first-party storage only. No cookies, no third parties.
 */
export function captureTouch(): { last: Touch; first: Touch | null } {
  if (typeof window === "undefined") return { last: { ...EMPTY_TOUCH }, first: null };
  if (memory) return memory;

  const { local, session } = storages();
  const now = touchFromUrl(window.location.href, document.referrer);

  let last = read(session, LAST_KEY);
  if (!last || hasSignal(now)) {
    last = now;
    write(session, LAST_KEY, last);
  }

  let first = read(local, FIRST_KEY);
  const expired = first?.at ? Date.now() - Date.parse(first.at) > FIRST_TOUCH_DAYS * 86_400_000 : true;
  if (!first || expired) {
    first = now;
    write(local, FIRST_KEY, first);
  }

  memory = { last, first };
  return memory;
}
