// The forensics eval (docs/10-FORENSICS.md §8, S8).
//
//   pnpm eval:forensics
//
// Runs the labelled fixture set through the real fingerprint at the real threshold and rewrites
// docs/FORENSIC_EVAL.md. The measurement itself is test/integration/forensics-eval.test.ts
// (scripts may not import src/server); it runs on every integration run, and writes the
// document only when started from here.
import { spawnSync } from "node:child_process";

const run = spawnSync("pnpm", ["test:integration", "forensics-eval"], {
  env: { ...process.env, WRITE_FORENSIC_EVAL: "1" },
  stdio: "inherit",
  shell: true, // pnpm is pnpm.cmd on Windows
});
process.exit(run.status ?? 1);
