"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { authConfig, clientIp, createSessionToken, hashIp, passwordMatches, SESSION_COOKIE, SESSION_HOURS } from "@/lib/session";
import { recentFailedLogins, recordLoginAttempt } from "@/lib/store";

export interface LoginState {
  error: string;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const config = authConfig();
  if (!config) return { error: "The admin is not set up yet. Set ADMIN_PASSWORD and SESSION_SECRET on the server." };

  const h = await headers();
  const ipHash = hashIp(clientIp(h)) || "unknown";
  let db;
  try {
    db = await getDb();
    if ((await recentFailedLogins(db, ipHash, 15)) >= 8) {
      return { error: "Too many wrong passwords. Wait 15 minutes and try again." };
    }
  } catch (err) {
    console.error("[login] database unavailable:", err);
    return { error: "The database is not reachable, so sign-in is closed. Check DATABASE_URL." };
  }

  const candidate = formData.get("password");
  const ok = typeof candidate === "string" && passwordMatches(candidate, config);
  await recordLoginAttempt(db, ipHash, ok);
  if (!ok) return { error: "That password is not right." };

  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(config), {
    httpOnly: true,
    secure: h.get("x-forwarded-proto") === "https",
    sameSite: "lax",
    path: "/admin",
    maxAge: SESSION_HOURS * 3600,
  });
  redirect("/admin");
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/admin", maxAge: 0 });
  redirect("/admin/login");
}
