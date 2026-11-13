// Deterministic replay (docs/10-FORENSICS.md §7, S6).
//
//   pnpm forensics:replay <submissionId>
//
// Re-reads the stored bytes, re-runs the deterministic stages and exits non-zero unless the
// result is byte-identical to the stored findings. A mismatch means the pipeline drifted.
// It reads the database and evidence store of the current environment, and needs the
// FORENSICS_MATCH_KEY the findings were written under (cross-organisation references are keyed).
//
// Scripts may not import src/server (it imports server-only), so the work is
// test/tools/replay-forensics.ts, run by vitest under the integration config.
import { spawnSync } from "node:child_process";

const id = process.argv[2] ?? "";
if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
  console.error("usage: pnpm forensics:replay <submissionId>");
  process.exit(2);
}
const run = spawnSync("pnpm", ["exec", "vitest", "run", "--config", "vitest.integration.config.ts"], {
  env: { ...process.env, DELTA_TOOL: "replay-forensics", REPLAY_SUBMISSION_ID: id },
  stdio: "inherit",
  shell: true, // pnpm is pnpm.cmd on Windows
});
process.exit(run.status ?? 1);
