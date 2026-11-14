// Merkle batching and anchoring (docs/09-WEB3.md §4 to §6), against
// a local anvil chain with the real contract: never Base Sepolia, never a real key.
//   - the manifest is sealed at approval and hashes to what is stored
//   - the batch and its proofs are in the database before the transaction is sent
//   - ANCHORED is reached only after the chain confirms
//   - a transaction that would revert leaves the records APPROVED, and the same batch is sent again
//   - the tree is reproducible from the public proof, and the contract verifies each leaf
//   - the database refuses to anchor a manifest version twice
//   - a manifest changed after approval is never anchored
import { asc, eq, inArray, sql } from "drizzle-orm";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startLocalChain, type LocalChain } from "../../scripts/lib/local-chain";
import { GET as dailyRoute } from "../../src/app/api/internal/anchor/daily/route";
import { leafHash, REGISTRY_ABI } from "../../src/lib/chain/registry";
import { manifestHash, type Manifest } from "../../src/lib/crypto/manifest";
import { buildMerkleTree, merkleLeaf } from "../../src/lib/crypto/merkle";
import type { ChainPort } from "../../src/server/chain/port";
import { anchorBatch, anchorLeaf, auditEvent, evidenceFile, evidenceSubmission, projectPrivateLocation } from "../../src/server/db/schema";
import { anchorNow, anchorOverview, anchorPending, viemChain } from "../../src/server/services/anchor.service";
import { verifyChainRows } from "../../src/server/services/audit-chain.service";
import { ForbiddenError } from "../../src/server/services/errors";
import { castDecision } from "../../src/server/services/reviews.service";
import { getPublicProof } from "../../src/server/services/submissions.service";
import { client, inRollback, pgError, type Tx } from "./db";
import { actor, addSubmission, asOperators, REASON, world, type World } from "./fixtures";

type Hex = `0x${string}`;

let local: LocalChain;
let chain: ChainPort;
const reader = () => createPublicClient({ chain: baseSepolia, transport: http(local.rpcUrl) });

beforeAll(async () => {
  // its own port and deployer, so neither the address nor the batches of a development chain are shared
  local = await startLocalChain({ port: 8546, deployer: 5 });
  chain = viemChain({ rpcUrl: local.rpcUrl, privateKey: local.anchorerKey, contractAddress: local.contractAddress, receiptTimeoutMs: 15_000 });
});
afterAll(async () => {
  local?.stop();
  await client.end();
});

const SHA = (c: string) => c.repeat(64);
const DHASH = "01".repeat(32);

/** A submission with a before/after pair, approved by two reviewers through the real service. */
async function approved(tx: Tx, w: World, shas: [string, string]) {
  const s = await addSubmission(tx, { projectId: w.project.id, ownerOrgId: w.org.owner.id, userId: w.u.ownerMember.id });
  await tx.insert(evidenceFile).values([
    { submissionId: s.id, role: "AFTER", storageKey: `anchor-test/${s.id}/a.jpg`, mime: "image/jpeg", sizeBytes: 10, sha256: SHA(shas[1]) },
    { submissionId: s.id, role: "BEFORE", storageKey: `anchor-test/${s.id}/b.jpg`, mime: "image/jpeg", sizeBytes: 10, sha256: SHA(shas[0]), dhash: DHASH },
  ]);
  await castDecision(actor(w.u.v1), s.id, { decision: "APPROVE", reason: REASON }, tx);
  await castDecision(actor(w.u.v2), s.id, { decision: "APPROVE", reason: REASON }, tx);
  return s.id;
}

const statusOf = async (tx: Tx, ids: string[]) =>
  (await tx.select({ id: evidenceSubmission.id, status: evidenceSubmission.status }).from(evidenceSubmission).where(inArray(evidenceSubmission.id, ids))).map((r) => r.status);
const batchOf = async (tx: Tx, submissionId: string) =>
  (await tx.select({ b: anchorBatch }).from(anchorLeaf).innerJoin(anchorBatch, eq(anchorBatch.id, anchorLeaf.batchId)).where(eq(anchorLeaf.submissionId, submissionId)))[0]?.b;

describe("the manifest is sealed at approval", () => {
  it("is the canonical record, hashes to what is stored, and binds the owner's audit chain head", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const id = await approved(tx, w, ["a", "b"]);
      const [row] = await tx.select().from(evidenceSubmission).where(eq(evidenceSubmission.id, id));
      const manifest = row!.manifest as Manifest;

      expect(row!.status).toBe("APPROVED");
      expect(await manifestHash(manifest)).toBe(row!.manifestHash);
      expect(manifest).toMatchObject({ schema: "delta.manifest.v2", submissionId: id, projectId: w.project.id, ownerOrgId: w.org.owner.id, verifierOrgId: w.org.verifier.id });
      // BEFORE first whatever order the rows were written in; dhash null, not absent, where there is none
      expect(manifest.files).toEqual([
        { role: "BEFORE", round: 1, sha256: SHA("a"), dhash: DHASH },
        { role: "AFTER", round: 1, sha256: SHA("b"), dhash: null },
      ]);
      expect(manifest.approvedAtIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(manifest.quorumReviewIds).toHaveLength(2);
      expect(manifest.locationCommitment).toMatch(/^[0-9a-f]{64}$/);

      // the head it commits to is the event of the approving decision itself
      const events = await tx.select().from(auditEvent).where(eq(auditEvent.orgId, w.org.owner.id)).orderBy(asc(auditEvent.seq));
      expect(manifest.orgAuditChainHead).toBe(events.at(-1)!.eventHash);
      expect(events.at(-1)!.payload).toMatchObject({ submissionId: id, status: "APPROVED" });
    }));

  it("a rejection, and an approval still short of quorum, seal nothing", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      await tx.insert(evidenceFile).values({ submissionId: w.submission.id, role: "BEFORE", storageKey: "anchor-test/x.jpg", mime: "image/jpeg", sizeBytes: 10, sha256: SHA("e") });
      await castDecision(actor(w.u.v1), w.submission.id, { decision: "APPROVE", reason: REASON }, tx);
      const [open] = await tx.select().from(evidenceSubmission).where(eq(evidenceSubmission.id, w.submission.id));
      expect([open!.status, open!.manifestHash]).toEqual(["IN_REVIEW", null]);
      await castDecision(actor(w.u.v2), w.submission.id, { decision: "REJECT", reason: REASON }, tx);
      await castDecision(actor(w.u.vAdmin), w.submission.id, { decision: "REJECT", reason: REASON }, tx);
      const [closed] = await tx.select().from(evidenceSubmission).where(eq(evidenceSubmission.id, w.submission.id));
      expect([closed!.status, closed!.manifestHash]).toEqual(["REJECTED", null]);
    }));
});

describe("anchorPending", () => {
  it("writes the batch and proofs before sending, confirms, and only then marks the records ANCHORED", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const ids = [await approved(tx, w, ["a", "b"]), await approved(tx, w, ["c", "d"]), await approved(tx, w, ["e", "f"])];

      // what the database held at the moment the transaction was sent
      let atSend: { leaves: number; batchStatus: string; statuses: string[] } | undefined;
      const watching: ChainPort = {
        ...chain,
        async sendAnchor(batchId, root, leafCount) {
          const leaves = await tx.select().from(anchorLeaf).where(eq(anchorLeaf.batchId, Number(batchId)));
          const [b] = await tx.select().from(anchorBatch).where(eq(anchorBatch.id, Number(batchId)));
          atSend = { leaves: leaves.length, batchStatus: b!.status, statuses: await statusOf(tx, ids) };
          expect(b!.merkleRoot).toBe(root);
          return chain.sendAnchor(batchId, root, leafCount);
        },
      };

      const run = await anchorPending({ only: ids }, tx, watching);
      expect(run.refused).toEqual([]);
      expect(run.created).toMatchObject({ leafCount: 3 });
      expect(atSend).toEqual({ leaves: 3, batchStatus: "SUBMITTED", statuses: ["APPROVED", "APPROVED", "APPROVED"] });

      const batch = (await batchOf(tx, ids[0]!))!;
      expect(run.batches.find((b) => b.batchId === batch.id)).toMatchObject({ status: "CONFIRMED", leafCount: 3, error: null });
      expect(batch).toMatchObject({ status: "CONFIRMED", leafCount: 3, chainId: 84532, contractAddress: local.contractAddress });
      expect(batch.txHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(batch.blockNumber).toBeGreaterThan(0);
      expect(batch.confirmedAt).toBeInstanceOf(Date);
      expect(await statusOf(tx, ids)).toEqual(["ANCHORED", "ANCHORED", "ANCHORED"]);

      // the chain holds exactly this root
      const onChain = await reader().readContract({ address: local.contractAddress, abi: REGISTRY_ABI, functionName: "getAnchor", args: [BigInt(batch.id)] });
      expect(onChain.merkleRoot).toBe(batch.merkleRoot);
      expect(onChain.leafCount).toBe(3);

      // reproducible by a stranger: the manifests from the public proof rebuild the same tree
      const proofs = await Promise.all(ids.map((id) => getPublicProof(id, tx)));
      const leaves = await Promise.all(proofs.map(async (p) => merkleLeaf(p.submission.id, await manifestHash(p.manifest!), p.manifest!.approvedAtIso)));
      expect(buildMerkleTree(leaves).root).toBe(onChain.merkleRoot);

      // the public proof, manifest included, holds nothing of the exact site
      const [site] = await tx.select().from(projectPrivateLocation).where(eq(projectPrivateLocation.projectId, w.project.id));
      for (const secret of [site!.locationSalt.toString("hex"), JSON.stringify(site!.boundary.coordinates[0]![0])]) expect(JSON.stringify(proofs)).not.toContain(secret);

      // and the contract verifies each record's own leaf with the stored proof path, and nothing else
      for (const [i, p] of proofs.entries()) {
        expect(p.submission).toMatchObject({ status: "ANCHORED", anchored: true });
        expect(p.anchor).toMatchObject({ batchId: batch.id, status: "CONFIRMED", merkleRoot: batch.merkleRoot, txHash: batch.txHash });
        const verify = (leaf: Hex) => reader().readContract({ address: local.contractAddress, abi: REGISTRY_ABI, functionName: "verify", args: [BigInt(batch.id), p.anchor!.proof as Hex[], leaf] });
        expect(await verify(leafHash(leaves[i]!))).toBe(true);
        // the same record with one file hash changed: what a browser would compute from a tampered manifest
        const tampered = { ...p.manifest!, files: p.manifest!.files.map((f, n) => (n === 0 ? { ...f, sha256: SHA("9") } : f)) };
        expect(await verify(leafHash(merkleLeaf(p.submission.id, await manifestHash(tampered), tampered.approvedAtIso)))).toBe(false);
      }

      // the move is on the owner's audit chain, and the chain still verifies
      const events = await tx.select().from(auditEvent).where(eq(auditEvent.orgId, w.org.owner.id)).orderBy(asc(auditEvent.seq));
      expect(events.at(-1)).toMatchObject({ eventType: "ANCHOR_CONFIRMED", actorUserId: null });
      expect(events.at(-1)!.payload).toMatchObject({ batchId: batch.id, merkleRoot: batch.merkleRoot, txHash: batch.txHash, submissionIds: [...ids].sort() });
      expect(verifyChainRows(events)).toMatchObject({ ok: true });

      // nothing is left to do, and nothing is anchored twice
      expect(await anchorPending({ only: ids }, tx, chain)).toMatchObject({ created: null, refused: [] });
      expect(
        await pgError(tx.transaction((sp) => sp.insert(anchorLeaf).values({ batchId: batch.id, submissionId: ids[0]!, manifestHash: SHA("0"), manifestVersion: 1, leafIndex: 9, proof: [] }))),
      ).toMatch(/anchor_leaf_submission_version_uidx/);
    }));

  it("an unconfirmed transaction leaves the batch SUBMITTED and the records APPROVED; the next run confirms it", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const ids = [await approved(tx, w, ["a", "b"])];
      const notMinedYet: ChainPort = { ...chain, anchoredRoot: async () => null, receipt: async () => null };

      const first = await anchorPending({ only: ids }, tx, notMinedYet);
      const batchId = first.created!.batchId;
      expect(first.batches.find((b) => b.batchId === batchId)).toMatchObject({ status: "SUBMITTED", error: null });
      const sent = (await batchOf(tx, ids[0]!))!;
      expect(sent.status).toBe("SUBMITTED");
      expect(sent.txHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(await statusOf(tx, ids)).toEqual(["APPROVED"]);
      // still unconfirmed: it is polled, never sent a second time
      const again = await anchorPending({ only: ids }, tx, { ...notMinedYet, sendAnchor: () => Promise.reject(new Error("must not be sent twice")) });
      expect(again.batches.find((b) => b.batchId === batchId)).toMatchObject({ status: "SUBMITTED", txHash: sent.txHash, error: null });

      const second = await anchorPending({ only: ids }, tx, chain);
      expect(second.created).toBeNull();
      expect(second.batches.find((b) => b.batchId === batchId)).toMatchObject({ status: "CONFIRMED", txHash: sent.txHash });
      expect(await statusOf(tx, ids)).toEqual(["ANCHORED"]);
      expect((await batchOf(tx, ids[0]!))!.blockNumber).toBeGreaterThan(0);
    }));

  it("a transaction that would revert is never sent: the batch is FAILED, the records stay APPROVED, and the same batch succeeds later", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const ids = [await approved(tx, w, ["a", "b"]), await approved(tx, w, ["c", "d"])];
      const unauthorised = viemChain({ rpcUrl: local.rpcUrl, privateKey: local.strangerKey, contractAddress: local.contractAddress });

      const failed = await anchorPending({ only: ids }, tx, unauthorised);
      const batchId = failed.created!.batchId;
      const mine = failed.batches.find((b) => b.batchId === batchId)!;
      expect(mine).toMatchObject({ status: "FAILED", txHash: null });
      expect(mine.error).toMatch(/NotAnchorer/);
      expect((await batchOf(tx, ids[0]!))!.status).toBe("FAILED");
      expect(await statusOf(tx, ids)).toEqual(["APPROVED", "APPROVED"]);
      expect(await reader().readContract({ address: local.contractAddress, abi: REGISTRY_ABI, functionName: "verify", args: [BigInt(batchId), [], `0x${SHA("0")}`] })).toBe(false);

      // no new batch: the leaves exist once, and the same batch goes out under the same id
      const retried = await anchorPending({ only: ids }, tx, chain);
      expect(retried.created).toBeNull();
      expect(retried.batches.find((b) => b.batchId === batchId)).toMatchObject({ status: "CONFIRMED", error: null });
      expect(await statusOf(tx, ids)).toEqual(["ANCHORED", "ANCHORED"]);
    }));

  it("a reverted transaction fails the batch and moves nothing", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const ids = [await approved(tx, w, ["a", "b"])];
      const reverting: ChainPort = { ...chain, sendAnchor: async () => `0x${SHA("1")}`, anchoredRoot: async () => null, receipt: async () => ({ ok: false, blockNumber: BigInt(1) }) };
      const run = await anchorPending({ only: ids }, tx, reverting);
      expect(run.batches.find((b) => b.batchId === run.created!.batchId)).toMatchObject({ status: "FAILED", error: "the transaction reverted" });
      expect(await statusOf(tx, ids)).toEqual(["APPROVED"]);
    }));

  it("a manifest changed after approval is refused, not anchored", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const ids = [await approved(tx, w, ["a", "b"]), await approved(tx, w, ["c", "d"])];
      await tx.update(evidenceSubmission).set({ manifest: sql`jsonb_set(${evidenceSubmission.manifest}, '{projectId}', '"00000000-0000-4000-8000-000000000000"')` }).where(eq(evidenceSubmission.id, ids[0]!));

      const run = await anchorPending({ only: ids }, tx, chain);
      expect(run.refused).toEqual([ids[0]]);
      expect(run.created).toMatchObject({ leafCount: 1 });
      const rows = await tx.select({ id: evidenceSubmission.id, status: evidenceSubmission.status }).from(evidenceSubmission).where(inArray(evidenceSubmission.id, ids));
      expect(Object.fromEntries(rows.map((r) => [r.id, r.status]))).toEqual({ [ids[0]!]: "APPROVED", [ids[1]!]: "ANCHORED" });
      expect(await batchOf(tx, ids[0]!)).toBeUndefined();
    }));
});

describe("who may run anchoring", () => {
  it("an operator, and nobody else: not a verifier organisation's admin either", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      for (const who of [w.u.ownerAdmin, w.u.ownerMember, w.u.v1, w.u.vAdmin, w.u.funder, w.u.platformAdmin, w.u.outsider]) {
        await expect(anchorNow(actor(who), tx, chain)).rejects.toBeInstanceOf(ForbiddenError);
        await expect(anchorOverview(actor(who), tx)).rejects.toBeInstanceOf(ForbiddenError);
      }
      const id = await approved(tx, w, ["a", "b"]);
      const op = actor(w.u.platformAdmin);
      await asOperators([w.u.platformAdmin], async () => {
        const before = await anchorOverview(op, tx);
        expect(before.waiting).toBeGreaterThanOrEqual(1);
        // a narrowed run is the service's own; "Anchor now" batches everything waiting
        const run = await anchorNow(op, tx, chain);
        expect(run.created!.leafCount).toBe(before.waiting);
        expect(await statusOf(tx, [id])).toEqual(["ANCHORED"]);
        const after = await anchorOverview(op, tx);
        expect(after.waiting).toBe(0);
        expect(after.batches[0]).toMatchObject({ id: run.created!.batchId, status: "CONFIRMED" });
      });
      const events = await tx.select().from(auditEvent).where(eq(auditEvent.orgId, w.org.owner.id)).orderBy(asc(auditEvent.seq));
      expect(events.at(-1)).toMatchObject({ eventType: "ANCHOR_CONFIRMED", actorUserId: w.u.platformAdmin.id });
    }));
});

describe("GET /api/internal/anchor/daily", () => {
  it("refuses without the cron secret, and says so when no chain is configured", async () => {
    const saved = Object.fromEntries(["CRON_SECRET", "BASE_SEPOLIA_RPC_URL", "ANCHOR_CONTRACT_ADDRESS"].map((k) => [k, process.env[k]]));
    process.env.CRON_SECRET = "test-secret-that-is-long-enough";
    delete process.env.BASE_SEPOLIA_RPC_URL;
    delete process.env.ANCHOR_CONTRACT_ADDRESS;
    try {
      const call = (auth?: string) => dailyRoute(new Request("http://test/api/internal/anchor/daily", { headers: auth ? { authorization: auth } : {} }));
      expect((await call()).status).toBe(401);
      expect((await call("Bearer wrong")).status).toBe(401);
      const unconfigured = await call("Bearer test-secret-that-is-long-enough");
      expect(unconfigured.status).toBe(503);
      expect(JSON.stringify(await unconfigured.json())).not.toMatch(/0x/);
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
