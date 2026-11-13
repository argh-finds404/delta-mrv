// The work behind scripts/replay-forensics.ts (docs/10-FORENSICS.md §7). It runs under vitest
// with the integration config because the service imports server-only and scripts may not
// import src/server. Read-only: nothing is written, whatever the outcome.
import { afterAll, expect, it } from "vitest";
import { replayForensics } from "../../src/server/services/forensics.service";
import { client } from "../integration/db";

afterAll(() => client.end());

it("the stored findings are byte-identical to a fresh run over the stored bytes", async () => {
  const r = await replayForensics(process.env.REPLAY_SUBMISSION_ID ?? "");
  console.log(`replay: ${r.stored.length} stored findings, ${r.expected.length} recomputed; file facts ${r.filesMatch ? "identical" : "DIFFER"}`);
  if (!r.stored.length) console.log("replay: nothing is stored for this submission, so forensics never ran on it (true of the seeded history)");
  expect(r.expected).toEqual(r.stored);
  expect(r.filesMatch).toBe(true);
});
