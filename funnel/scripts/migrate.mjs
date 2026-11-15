// Applies db/migrations/*.sql to the database in DATABASE_URL, in name order,
// skipping any already applied.   Usage:  DATABASE_URL=… npm run db:migrate
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is not set. Nothing was changed.");
  process.exit(1);
}
const dir = path.join(import.meta.dirname, "..", "db", "migrations");
const ca = process.env.DATABASE_CA_CERT?.trim();
const client = new pg.Client({ connectionString: url, ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}) });

await client.connect();
try {
  await client.query(
    "create table if not exists public.cda_funnel_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const done = new Set((await client.query("select name from public.cda_funnel_migrations")).rows.map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) {
      console.log(`  already applied  ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into public.cda_funnel_migrations (name) values ($1)", [file]);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw new Error(`${file} failed and was rolled back: ${err.message}`);
    }
    console.log(`  applied          ${file}`);
    applied += 1;
  }
  console.log(applied === 0 ? "Database is up to date." : `Applied ${applied} migration${applied === 1 ? "" : "s"}.`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
