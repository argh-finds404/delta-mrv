// API keys and the funder's read path (docs/04-AUTH.md §5 and §7, docs/AGENT_PROMPTS.md 7a):
//   - only the prefix and a SHA-256 are stored; the key is shown once
//   - a wrong, unknown or malformed key is nobody; a revoked key stops working at once
//   - a key belongs to one organisation, and only its members can make, list or revoke it
//   - a funder sees its linked projects' APPROVED and ANCHORED records, and nothing else
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { GET as statsRoute } from "../../src/app/api/v1/stats/route";
import { apiKey, evidenceSubmission, projectFunder } from "../../src/server/db/schema";
import { authenticateApiKey, createApiKey, listApiKeys, revokeApiKey } from "../../src/server/services/api-key.service";
import { NotFoundError, ValidationError } from "../../src/server/services/errors";
import { funderPortfolio, myFunderPortfolio } from "../../src/server/services/funder.service";
import { client, inRollback } from "./db";
import { actor, addSubmission, world } from "./fixtures";

afterAll(() => client.end());

describe("API keys", () => {
  it("stores a prefix and a hash, authenticates the key it issued, and nothing else", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const made = await createApiKey(actor(w.u.funder), w.org.funder.id, undefined, tx);
      expect(made.key).toMatch(/^dmrv_[0-9a-f]{12}_[A-Za-z0-9_-]{43}$/);
      expect(made.key.split("_")[1]).toBe(made.keyPrefix);

      const [row] = await tx.select().from(apiKey).where(eq(apiKey.id, made.id));
      expect(row!.keyHash).toBe(createHash("sha256").update(made.key).digest("hex"));
      expect(JSON.stringify(row)).not.toContain(made.key.split("_")[2]);
      expect(row).toMatchObject({ orgId: w.org.funder.id, scopes: ["stats:read"], revokedAt: null, lastUsedAt: null });

      expect(await authenticateApiKey(`Bearer ${made.key}`, tx)).toEqual({ keyId: made.id, orgId: w.org.funder.id, scopes: ["stats:read"] });
      const [used] = await tx.select().from(apiKey).where(eq(apiKey.id, made.id));
      expect(used!.lastUsedAt).toBeInstanceOf(Date);

      // the right prefix with another secret, no Bearer, garbage, nothing
      const forged = `dmrv_${made.keyPrefix}_${"A".repeat(43)}`;
      for (const bad of [`Bearer ${forged}`, made.key, `Bearer ${made.key}x`, "Bearer dmrv_zz", "Bearer ", null]) {
        expect(await authenticateApiKey(bad, tx)).toBeNull();
      }
    }));

  it("a revoked key stops working at once and stays on record", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const made = await createApiKey(actor(w.u.funder), w.org.funder.id, undefined, tx);
      const other = await createApiKey(actor(w.u.funder), w.org.funder.id, undefined, tx);
      await revokeApiKey(actor(w.u.funder), made.id, tx);
      expect(await authenticateApiKey(`Bearer ${made.key}`, tx)).toBeNull();
      expect(await authenticateApiKey(`Bearer ${other.key}`, tx)).not.toBeNull();
      await revokeApiKey(actor(w.u.funder), made.id, tx); // again: not an error

      const listed = await listApiKeys(actor(w.u.funder), tx);
      expect(listed.map((k) => [k.id, k.revokedAt !== null]).sort()).toEqual([[made.id, true], [other.id, false]].sort());
      expect(JSON.stringify(listed)).not.toMatch(/keyHash|dmrv_/);
    }));

  it("belongs to one organisation: outsiders cannot make, see or revoke it", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const made = await createApiKey(actor(w.u.funder), w.org.funder.id, undefined, tx);
      for (const who of [w.u.ownerAdmin, w.u.v1, w.u.platformAdmin]) {
        await expect(createApiKey(actor(who), w.org.funder.id, undefined, tx)).rejects.toBeInstanceOf(NotFoundError);
        await expect(revokeApiKey(actor(who), made.id, tx)).rejects.toBeInstanceOf(NotFoundError);
        expect((await listApiKeys(actor(who), tx)).map((k) => k.id)).not.toContain(made.id);
      }
      expect(await authenticateApiKey(`Bearer ${made.key}`, tx)).not.toBeNull();
      await expect(createApiKey(actor(w.u.funder), w.org.funder.id, ["submissions:write"], tx)).rejects.toBeInstanceOf(ValidationError);
      await expect(createApiKey(actor(w.u.funder), w.org.funder.id, [], tx)).rejects.toBeInstanceOf(ValidationError);
    }));

  it("GET /api/v1/stats answers 401 without a live key", async () => {
    const call = (auth?: string) => statsRoute(new Request("http://test/api/v1/stats", { headers: auth ? { authorization: auth } : {} }));
    expect((await call()).status).toBe(401);
    expect((await call(`Bearer dmrv_${"0".repeat(12)}_${"A".repeat(43)}`)).status).toBe(401);
  });
});

describe("the funder portfolio", () => {
  it("counts only the approved and anchored records of linked projects", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const add = (status: "APPROVED" | "ANCHORED" | "REJECTED" | "ESCALATED") => addSubmission(tx, { projectId: w.project.id, ownerOrgId: w.org.owner.id, userId: w.u.ownerMember.id, status });
      const approved = await add("APPROVED");
      const anchored = await add("ANCHORED");
      await add("REJECTED");
      await add("ESCALATED");

      // not linked: nothing, whatever the project holds
      expect((await myFunderPortfolio(actor(w.u.funder), tx))!.totals).toEqual({ projects: 0, approved: 0, anchored: 0, hectaresWithApprovedRecords: 0, verifierOrgs: 0 });

      await tx.insert(projectFunder).values({ projectId: w.project.id, funderOrgId: w.org.funder.id, createdByUserId: w.u.ownerAdmin.id });
      const mine = (await myFunderPortfolio(actor(w.u.funder), tx))!;
      expect(mine).toMatchObject({ orgId: w.org.funder.id, orgName: w.org.funder.name });
      expect(mine.totals).toMatchObject({ projects: 1, approved: 2, anchored: 1, verifierOrgs: 1 });
      // the fixture's boundary is about a kilometre square: its real area, from PostGIS
      expect(mine.totals.hectaresWithApprovedRecords).toBeGreaterThan(100);
      expect(mine.totals.hectaresWithApprovedRecords).toBeLessThan(125);
      expect(mine.projects).toEqual([expect.objectContaining({ id: w.project.id, approved: 2, anchored: 1, ownerOrgName: w.org.owner.name })]);
      // the IN_REVIEW, REJECTED and ESCALATED records are not listed, counted or hinted at
      expect(mine.latest.map((l) => l.submissionId).sort()).toEqual([approved.id, anchored.id].sort());

      // a site with no approved record contributes no area
      await tx.update(evidenceSubmission).set({ status: "REJECTED" }).where(eq(evidenceSubmission.projectId, w.project.id));
      expect((await funderPortfolio([w.org.funder.id], tx)).totals).toMatchObject({ projects: 1, approved: 0, anchored: 0, hectaresWithApprovedRecords: 0 });

      // nobody else has a funder portfolio at all
      for (const who of [w.u.ownerAdmin, w.u.v1, w.u.platformAdmin]) expect(await myFunderPortfolio(actor(who), tx)).toBeNull();
    }));
});
