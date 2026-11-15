import fs from "node:fs";
import path from "node:path";

/**
 * One small query interface, two backends:
 *
 *  - DATABASE_URL set  → a real Postgres (Supabase or any other host), via `pg`.
 *  - DATABASE_URL unset, not production → an embedded Postgres (PGlite) stored in
 *    ./data/pglite, so the app runs on a laptop with nothing else installed.
 *  - DATABASE_URL unset in production → an error. Leads are never accepted into
 *    a store that would vanish with the server.
 */
export interface Db {
  kind: "postgres" | "pglite";
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export class DbNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set. In production the funnel needs a Postgres database for leads.");
    this.name = "DbNotConfiguredError";
  }
}

export const MIGRATIONS_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "db", "migrations");

/** Applies every .sql file in db/migrations that has not been applied yet, in name order. */
export async function migrate(db: Db, dir = MIGRATIONS_DIR): Promise<string[]> {
  await db.exec(
    "create table if not exists public.cda_funnel_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const done = new Set(
    (await db.query<{ name: string }>("select name from public.cda_funnel_migrations")).map((r) => r.name),
  );
  // Development and tests only (the embedded database). Production uses `npm run db:migrate`.
  const files = fs.readdirSync(/*turbopackIgnore: true*/ dir).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(/*turbopackIgnore: true*/ path.join(dir, file), "utf8");
    await db.exec(`begin;\n${sql}\ninsert into public.cda_funnel_migrations (name) values ('${file.replace(/'/g, "''")}');\ncommit;`);
    applied.push(file);
  }
  return applied;
}

export async function openPglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dataDir) fs.mkdirSync(/*turbopackIgnore: true*/ dataDir, { recursive: true });
  const pg = new PGlite(dataDir);
  await pg.waitReady;
  return {
    kind: "pglite",
    async query<T>(text: string, params: unknown[] = []) {
      const res = await pg.query<T>(text, params as never[]);
      return res.rows;
    },
    async exec(sql: string) {
      await pg.exec(sql);
    },
    async close() {
      await pg.close();
    },
  };
}

export async function openPostgres(connectionString: string, caCert?: string): Promise<Db> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    // With a CA certificate the server's certificate is verified against it.
    // Without one, TLS behaviour follows the connection string (sslmode=…).
    ...(caCert ? { ssl: { ca: caCert, rejectUnauthorized: true } } : {}),
  });
  // An idle client dropping must not take the server process down with it.
  pool.on("error", (err) => console.error("[db] idle client error:", err.message));
  return {
    kind: "postgres",
    async query<T>(text: string, params: unknown[] = []) {
      const res = await pool.query(text, params);
      return res.rows as T[];
    },
    async exec(sql: string) {
      const client = await pool.connect();
      try {
        await client.query(sql);
      } catch (err) {
        await client.query("rollback").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

const globalForDb = globalThis as unknown as { __cdaFunnelDb?: Promise<Db> };

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return openPostgres(url, process.env.DATABASE_CA_CERT?.trim() || undefined);
  // ALLOW_EMBEDDED_DB=1 exists for one purpose: trying a production build on a
  // laptop. Never set it on a real host — the embedded database lives on the
  // server's own disk and disappears with it.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_EMBEDDED_DB !== "1") {
    throw new DbNotConfiguredError();
  }
  const db = await openPglite(process.env.PGLITE_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "pglite"));
  await migrate(db);
  return db;
}

/** The process-wide database handle. A failed open is not cached, so the next request retries. */
export function getDb(): Promise<Db> {
  if (!globalForDb.__cdaFunnelDb) {
    globalForDb.__cdaFunnelDb = open().catch((err) => {
      globalForDb.__cdaFunnelDb = undefined;
      throw err;
    });
  }
  return globalForDb.__cdaFunnelDb;
}
