import fs from "node:fs";
import { it } from "vitest";
import { launchBlockers } from "@/lib/launch";

// Not a test of anything: it hands the site's own launch-gate result to
// scripts/launch-check.mjs, so the command and the site can never disagree.
it("reports launch blockers", () => {
  fs.writeFileSync(process.env.LAUNCH_CHECK_OUT!, JSON.stringify(launchBlockers()));
});
