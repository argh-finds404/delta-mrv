// Audit chain verification over the whole database (docs/02-ARCHITECTURE.md §6, the Stage 5 gate).
//
//   pnpm audit:verify
//
// Walks every organisation's chain from genesis and exits non-zero at the first event whose
// hash does not follow from the one before it. Read-only. The same check is on /admin.
//
// Scripts may not import src/server (it imports server-only), so the work is
// test/tools/verify-audit-chain.ts, run by vitest under the integration config.
import { spawnSync } from "node:child_process";

const run = spawnSync("pnpm", ["exec", "vitest", "run", "--config", "vitest.integration.config.ts"], {
  env: { ...process.env, DELTA_TOOL: "verify-audit-chain" },
  stdio: "inherit",
  shell: true, // pnpm is pnpm.cmd on Windows
});
process.exit(run.status ?? 1);
