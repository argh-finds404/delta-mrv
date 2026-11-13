// The work behind scripts/verify-audit-chain.ts. Runs under vitest with the integration config
// because the service imports server-only. Read-only.
import { afterAll, expect, it } from "vitest";
import { verifyAuditChains } from "../../src/server/services/audit-chain.service";
import { client } from "../integration/db";

afterAll(() => client.end());

it("every organisation's audit chain verifies from genesis", async () => {
  const reports = await verifyAuditChains();
  const events = reports.reduce((n, r) => n + r.events, 0);
  // an empty database verifies nothing: say so instead of passing quietly
  expect(events, "no audit events in this database").toBeGreaterThan(0);
  expect(reports.filter((r) => !r.ok)).toEqual([]);
});
