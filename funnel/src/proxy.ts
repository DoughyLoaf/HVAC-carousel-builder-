import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfig, SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * First line of defence for /admin: no valid session cookie, no page.
 * Every admin page and every server action checks the session again itself
 * (src/lib/admin.ts) — this is the fast redirect, not the only lock.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();
  if (verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, authConfig())) return NextResponse.next();
  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
