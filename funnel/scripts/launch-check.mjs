// Prints what still blocks launch. Exits 1 while anything does.
//   npm run launch:check
// The answer comes from src/lib/launch.ts — the same code the site uses to
// decide whether it may leave preview.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cda-launch-")), "blockers.json");
const run = spawnSync("npx", ["vitest", "run", "--config", "vitest.launch.config.mts"], {
  cwd: path.join(import.meta.dirname, ".."),
  env: { ...process.env, LAUNCH_CHECK_OUT: out },
  encoding: "utf8",
});
if (run.status !== 0 || !fs.existsSync(out)) {
  console.error("The launch check could not run:\n");
  console.error(run.stdout + run.stderr);
  process.exit(2);
}

const blockers = JSON.parse(fs.readFileSync(out, "utf8"));
if (blockers.length === 0) {
  console.log("Nothing blocks launch. Set SITE_MODE=live and deploy.");
  process.exit(0);
}
console.log(`${blockers.length} item${blockers.length === 1 ? "" : "s"} still block launch. The site stays in preview until this list is empty.\n`);
for (const b of blockers) console.log(`  • ${b.label}\n      ${b.why}\n`);
console.log("Settle each one in content/site.ts (see the Launch page in the admin for sources).");
process.exit(1);
