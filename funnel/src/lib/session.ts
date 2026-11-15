import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Admin sessions: one shared password (ADMIN_PASSWORD) and a signed, expiring
 * cookie (signed with SESSION_SECRET). No user accounts — this is a small
 * private workspace, not a multi-tenant product.
 *
 * This file has no Next.js imports so the proxy, the server and tests share it.
 */
export const SESSION_COOKIE = "cda_admin";
export const SESSION_HOURS = 12;

export interface AuthConfig {
  password: string;
  secret: string;
}

/** Null when the admin is not configured — in which case nobody can sign in. */
export function authConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig | null {
  const password = env.ADMIN_PASSWORD ?? "";
  const secret = env.SESSION_SECRET ?? "";
  if (password.length < 10 || secret.length < 32) return null;
  return { password, secret };
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = createHash("sha256").update(a).digest();
  const bb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ab, bb);
}

export function passwordMatches(candidate: string, config: AuthConfig): boolean {
  return safeEqual(candidate, config.password);
}

export function createSessionToken(config: AuthConfig, now = Date.now()): string {
  const expires = now + SESSION_HOURS * 3600 * 1000;
  // The password is part of the signed material, so changing it signs everyone out.
  const payload = `v1.${expires}`;
  return `${payload}.${sign(`${payload}.${config.password}`, config.secret)}`;
}

export function verifySessionToken(token: string | undefined, config: AuthConfig | null, now = Date.now()): boolean {
  if (!token || !config) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const expires = Number(parts[1]);
  if (!Number.isFinite(expires) || expires < now) return false;
  return safeEqual(parts[2], sign(`v1.${parts[1]}.${config.password}`, config.secret));
}

/** A stable, non-reversible stand-in for an IP address, for rate limiting only. */
export function hashIp(ip: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!ip) return "";
  return createHash("sha256").update(`${env.SESSION_SECRET ?? "dev"}|${ip}`).digest("hex").slice(0, 32);
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() ?? "";
}
