/** CDA works on Pacific time; "today" and every date shown in the admin follow it. */
export const BUSINESS_TZ = "America/Los_Angeles";

export function todayInBusinessTz(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function formatWhen(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(d);
}

export function formatDay(ymd: string | null | undefined): string {
  if (!ymd) return "—";
  const d = new Date(`${ymd}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(d);
}

export const RANGES = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", all: "All time" } as const;
export type RangeKey = keyof typeof RANGES;

export function parseRange(raw: string | undefined): { key: RangeKey; since: Date | null } {
  const key: RangeKey = raw && raw in RANGES ? (raw as RangeKey) : "30";
  return { key, since: key === "all" ? null : new Date(Date.now() - Number(key) * 86_400_000) };
}
