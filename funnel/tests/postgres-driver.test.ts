import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openPostgres, type Db } from "@/lib/db";
import { addJob, attention, attributionRows, createLead, getLead, listLeads, outcomeBy, outcomeTotals, setLeadStatus } from "@/lib/store";
import { leadInput, touch } from "./helpers";

/**
 * The production path: the `pg` driver talking the real Postgres wire protocol,
 * with the schema put in place by scripts/migrate.mjs — the same command a
 * deploy runs. The server on the other end is an embedded Postgres behind a
 * TCP socket, so this proves the driver, the migration script and the SQL
 * agree; it does not prove anything about a particular host's TLS or pooler.
 */
const run = promisify(execFile);
const PORT = 54000 + Math.floor(Math.random() * 900);
const URL = `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`;
const migrateScript = path.join(import.meta.dirname, "..", "scripts", "migrate.mjs");

describe("Postgres driver + migration script", () => {
  let backing: PGlite;
  let server: PGLiteSocketServer;
  let db: Db;

  beforeAll(async () => {
    backing = await PGlite.create();
    // The app's pool opens up to three connections at once; let the test server accept them.
    server = new PGLiteSocketServer({ db: backing, port: PORT, host: "127.0.0.1", maxConnections: 5 });
    await server.start();
  });
  afterAll(async () => {
    await db?.close();
    await server.stop();
    await backing.close();
  });

  it("migrate.mjs refuses to run without DATABASE_URL", async () => {
    await expect(run("node", [migrateScript], { env: { ...process.env, DATABASE_URL: "" } })).rejects.toMatchObject({ code: 1 });
  });

  it("migrate.mjs applies the schema once, and is a no-op the second time", async () => {
    const env = { ...process.env, DATABASE_URL: URL };
    const first = await run("node", [migrateScript], { env });
    expect(first.stdout).toContain("applied          0001_init.sql");
    const second = await run("node", [migrateScript], { env });
    expect(second.stdout).toContain("already applied  0001_init.sql");
    expect(second.stdout).toContain("Database is up to date.");
  });

  it("stores and reads a lead through the pg driver with the same types as the embedded database", async () => {
    db = await openPostgres(URL);
    expect(db.kind).toBe("postgres");
    const lead = await createLead(
      db,
      leadInput({ name: "Wire Protocol", last_touch: touch({ utm_source: "gbp", utm_medium: "review", utm_campaign: "review-ask" }), first_touch: touch({ gclid: "x" }) }),
      { origin: "web_form", ipHash: "h" },
    );
    expect(lead.created_at).toBeInstanceOf(Date);
    expect(lead.influence).toBe("review");
    expect(lead.first_touch).toMatchObject({ gclid: "x" });
    expect(lead.last_touch).toMatchObject({ utm_campaign: "review-ask" });

    await addJob(db, lead.id, {
      job_type: "repair", description: "Igniter", status: "completed", scheduled_on: "2026-11-18", completed_on: "2026-11-18",
      reported_revenue_cents: 31500, revenue_reported_by: "Erika", revenue_reported_on: "2026-11-19",
    });
    const detail = (await getLead(db, lead.id))!;
    expect(detail.lead.status).toBe("won");
    expect(detail.jobs[0]).toMatchObject({ scheduled_on: "2026-11-18", reported_revenue_cents: 31500 });

    const totals = await outcomeTotals(db, null);
    expect(totals).toEqual({ leads: 1, contacted: 1, booked: 1, won: 1, revenue_cents: 31500 });
    expect(typeof totals.leads).toBe("number");
    expect(typeof totals.revenue_cents).toBe("number");
    expect((await outcomeTotals(db, new Date(Date.now() - 3600_000))).leads).toBe(1);
    expect((await outcomeBy(db, "campaign", null))[0]).toMatchObject({ key: "review-ask", won: 1 });
    expect((await listLeads(db))[0]).toMatchObject({ job_count: 1, revenue_cents: 31500, next_followup: null });
    expect((await attributionRows(db, null, true))[0]).toMatchObject({ name: "Wire Protocol", job_count: 1 });
    expect((await attention(db, "2026-11-15")).new_leads).toBe(0);
    expect(await setLeadStatus(db, lead.id, "lost", "test")).toBe(true);
  });

  it("the funnel tables are closed to Supabase's public API roles", async () => {
    const rows = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'cda_funnel' and c.relkind = 'r' order by c.relname`,
    );
    expect(rows.length).toBe(8);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
    const policies = await db.query("select 1 from pg_policies where schemaname = 'cda_funnel'");
    expect(policies).toEqual([]);
  });
});
