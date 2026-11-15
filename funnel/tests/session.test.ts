import { describe, expect, it } from "vitest";
import { authConfig, clientIp, createSessionToken, hashIp, passwordMatches, verifySessionToken } from "@/lib/session";

const config = { password: "correct horse battery", secret: "s".repeat(40) };

describe("admin sessions", () => {
  it("is unconfigured without a real password and secret", () => {
    expect(authConfig({} as never)).toBeNull();
    expect(authConfig({ ADMIN_PASSWORD: "short", SESSION_SECRET: "s".repeat(40) } as never)).toBeNull();
    expect(authConfig({ ADMIN_PASSWORD: "long enough pw", SESSION_SECRET: "short" } as never)).toBeNull();
    expect(authConfig({ ADMIN_PASSWORD: "long enough pw", SESSION_SECRET: "s".repeat(40) } as never)).not.toBeNull();
  });

  it("accepts its own token and nothing else", () => {
    const now = 1_800_000_000_000;
    const token = createSessionToken(config, now);
    expect(verifySessionToken(token, config, now + 1000)).toBe(true);
    expect(verifySessionToken(token, null, now)).toBe(false);
    expect(verifySessionToken(undefined, config, now)).toBe(false);
    expect(verifySessionToken("v1.9999999999999.forged", config, now)).toBe(false);
    expect(verifySessionToken(token.slice(0, -2) + "xx", config, now)).toBe(false);
  });

  it("expires, and cannot be extended by editing the expiry", () => {
    const now = 1_800_000_000_000;
    const token = createSessionToken(config, now);
    expect(verifySessionToken(token, config, now + 13 * 3600 * 1000)).toBe(false);
    const [v, , sig] = token.split(".");
    expect(verifySessionToken(`${v}.${now + 999 * 3600 * 1000}.${sig}`, config, now)).toBe(false);
  });

  it("changing the password or the secret signs everyone out", () => {
    const token = createSessionToken(config);
    expect(verifySessionToken(token, { ...config, password: "a different password" })).toBe(false);
    expect(verifySessionToken(token, { ...config, secret: "t".repeat(40) })).toBe(false);
  });

  it("passwordMatches", () => {
    expect(passwordMatches("correct horse battery", config)).toBe(true);
    expect(passwordMatches("correct horse batter", config)).toBe(false);
    expect(passwordMatches("", config)).toBe(false);
  });

  it("hashIp is stable and does not contain the address", () => {
    const h = hashIp("203.0.113.9", { SESSION_SECRET: "x" } as never);
    expect(h).toBe(hashIp("203.0.113.9", { SESSION_SECRET: "x" } as never));
    expect(h).not.toContain("203.0.113.9");
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(hashIp("", {} as never)).toBe("");
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
  });
});
