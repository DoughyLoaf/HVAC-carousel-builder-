import { NextResponse } from "next/server";

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export const fail = (message: string, status = 400, extra: Record<string, unknown> = {}) =>
  json({ error: message, ...extra }, status);

export function parseId(v: string): number | null {
  return /^\d{1,4}$/.test(v) ? Number(v) : null;
}
