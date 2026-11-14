// X1 and X2 against the database, with no network:
//   - forensics queues the satellite check once per submission; it adds one INFO finding, which
//     weighs nothing and changes no status, and runs once; disabled, it says so as "inconclusive"
//   - only the public cell centre is handed to the archive search; the exact boundary is used here
//   - a device signature sent with finalize is checked against the server's own fingerprints,
//     stored, fixed in the audit chain, and shown publicly only once approved and verified
import { createHash } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { captureStatement, toBase64Url } from "../../src/lib/capture-statement";
import { auditEvent, evidenceFile, evidenceSubmission, forensicFinding, job } from "../../src/server/db/schema";
import { runForensics } from "../../src/server/services/forensics.service";
import { runNdviCheck } from "../../src/server/services/ndvi.service";
import { createDraft, finalizeSubmission, getPublicProof, getSubmissionDetail, issueUploadToken, listFindings } from "../../src/server/services/submissions.service";
import type { NdviRequest, NdviResult } from "../../src/server/satellite/earth-search";
import { synthetic } from "../fixtures/forensics/images";
import { client, inRollback, type Tx } from "./db";
import { actor, SQUARE, world, type World } from "./fixtures";
import { memoryStorage } from "./memory-storage";

afterAll(() => client.end());
process.env.FORENSICS_MATCH_KEY ||= "test-forensics-match-key-of-at-least-32-chars";

async function upload(tx: Tx, w: World, store: ReturnType<typeof memoryStorage>, seed: number) {
  const d = await createDraft(actor(w.u.ownerMember), w.project.id, tx);
  const b = await issueUploadToken(actor(w.u.ownerMember), d.id, { role: "BEFORE", contentType: "image/jpeg" }, tx, store.port);
  const a = await issueUploadToken(actor(w.u.ownerMember), d.id, { role: "AFTER", contentType: "image/jpeg" }, tx, store.port);
  const [before, after] = [await synthetic(seed), await synthetic(seed + 1)];
  store.put(b.pathname, before);
  store.put(a.pathname, after);
  const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  return { id: d.id, files: [{ role: "BEFORE" as const, pathname: b.pathname }, { role: "AFTER" as const, pathname: a.pathname }], sha: { BEFORE: sha(before), AFTER: sha(after) } };
}

const ndviOf = (tx: Tx, id: string) => tx.select().from(forensicFinding).where(and(eq(forensicFinding.submissionId, id), eq(forensicFinding.kind, "SATELLITE_NDVI")));
const scoreOf = async (tx: Tx, id: string) => (await tx.select({ s: evidenceSubmission.riskScore, st: evidenceSubmission.status }).from(evidenceSubmission).where(eq(evidenceSubmission.id, id)))[0]!;

describe("the satellite cross-check job (X1)", () => {
  it("is queued once by forensics, and when disabled records why, weighing nothing and changing nothing", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const store = memoryStorage();
      const s = await upload(tx, w, store, 8300);
      await finalizeSubmission(actor(w.u.ownerMember), s.id, { files: s.files }, tx, store.port);
      await runForensics(s.id, 1, tx, store.port);
      expect(await tx.select({ k: job.kind }).from(job).where(eq(job.idempotencyKey, `ndvi:${s.id}`))).toEqual([{ k: "satellite.ndvi" }]);

      const before = await scoreOf(tx, s.id);
      expect(await runNdviCheck(s.id, tx, { enabled: false })).toBe("inconclusive");
      const [f] = await ndviOf(tx, s.id);
      expect(f).toMatchObject({ severity: "INFO", evidenceFileId: null, ruleVersion: "ndvi.v1", evidence: { outcome: "inconclusive" } });
      expect(f!.reason).toMatch(/inconclusive: the satellite cross-check is not enabled on this server/);
      expect(await scoreOf(tx, s.id)).toEqual(before); // INFO weighs nothing, and the status stays IN_REVIEW
      expect(before.st).toBe("IN_REVIEW");
      expect(await runNdviCheck(s.id, tx, { enabled: false })).toBe("already-checked");
      expect(await ndviOf(tx, s.id)).toHaveLength(1);
      // the owner, and so the reviewers, read it like any finding
      expect((await listFindings(actor(w.u.ownerMember), s.id, tx)).findings.map((x) => x.kind)).toContain("SATELLITE_NDVI");
    }));

  it("hands the archive search the public cell centre only, and records what it measured", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const store = memoryStorage();
      const s = await upload(tx, w, store, 8310);
      await finalizeSubmission(actor(w.u.ownerMember), s.id, { files: s.files }, tx, store.port);
      const asked: NdviRequest[] = [];
      const reading = (id: string, datetime: string, ndvi: number) => ({ sceneId: id, datetime, cloudCover: 2, ndvi, pixels: 80, clear: 78 });
      const check = async (req: NdviRequest): Promise<NdviResult> => {
        asked.push(req);
        return { outcome: "measured", baseline: reading("S2_A", "2026-01-20T04:50:00Z", 0.31), current: reading("S2_B", "2026-10-20T04:50:00Z", 0.72), delta: 0.41, telemetry: { endpoint: "fake", searched: [], scenes: [], bytesRead: 1, elapsedMs: 1 } };
      };
      expect(await runNdviCheck(s.id, tx, { enabled: true, check })).toBe("measured");
      expect(asked[0]!.searchPoint).toEqual(w.project.fuzzedLocation!.coordinates);
      expect(asked[0]!.ring).toEqual(SQUARE.coordinates[0]);
      const [f] = await ndviOf(tx, s.id);
      expect(f!.evidence).toMatchObject({ outcome: "measured", delta: 0.41, baseline: { sceneId: "S2_A", ndvi: 0.31 }, current: { sceneId: "S2_B" } });
      expect(f!.reason).toMatch(/^Advisory, not evidence: the Sentinel-2 vegetation index \(NDVI\) over the site was 0\.31 .* and 0\.72 .* a rise of 0\.41/);
    }));
});

describe("a device-signed capture (X2)", () => {
  async function signed(statement: string) {
    const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
    return {
      publicKey: toBase64Url(await crypto.subtle.exportKey("spki", keys.publicKey)),
      signature: toBase64Url(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, new TextEncoder().encode(statement))),
    };
  }

  it("is checked against the stored bytes, kept, fixed in the audit chain, and public only once approved", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const store = memoryStorage();
      const s = await upload(tx, w, store, 8320);
      const signedAt = "2026-11-14T08:30:00.000Z";
      const sig = await signed(captureStatement(w.project.id, [{ role: "BEFORE", sha256: s.sha.BEFORE }, { role: "AFTER", sha256: s.sha.AFTER }], signedAt));
      await finalizeSubmission(actor(w.u.ownerMember), s.id, { files: s.files, attestation: { kind: "device-key", ...sig, signedAt } }, tx, store.port);

      const detail = await getSubmissionDetail(actor(w.u.ownerMember), s.id, tx);
      expect(detail.capture).toMatchObject({ kind: "device-key", alg: "ES256", verified: true, signedAt, publicKey: sig.publicKey });
      const [finalized] = await tx.select().from(auditEvent).where(and(eq(auditEvent.orgId, w.org.owner.id), eq(auditEvent.eventType, "SUBMISSION_FINALIZED"))).orderBy(asc(auditEvent.seq));
      expect(finalized!.payload).toMatchObject({ submissionId: s.id, capture: { keyId: detail.capture!.keyId, verified: true, signature: sig.signature } });

      // not public while in review; public once approved, and only the parts a browser needs to re-check it
      await expect(getPublicProof(s.id, tx)).rejects.toThrow();
      await tx.update(evidenceSubmission).set({ status: "APPROVED" }).where(eq(evidenceSubmission.id, s.id));
      expect((await getPublicProof(s.id, tx)).capture).toEqual({ publicKey: sig.publicKey, signature: sig.signature, signedAt });
    }));

  it("that does not match the stored files is recorded as such, never shown as signed, and never blocks", () =>
    inRollback(async (tx) => {
      const w = await world(tx);
      const store = memoryStorage();
      const s = await upload(tx, w, store, 8330);
      const signedAt = "2026-11-14T08:30:00.000Z";
      // the device signed different fingerprints from the bytes that arrived
      const sig = await signed(captureStatement(w.project.id, [{ role: "BEFORE", sha256: "a".repeat(64) }, { role: "AFTER", sha256: s.sha.AFTER }], signedAt));
      const summary = await finalizeSubmission(actor(w.u.ownerMember), s.id, { files: s.files, attestation: { kind: "device-key", ...sig, signedAt } }, tx, store.port);
      expect(summary.status).toBe("PENDING_FORENSICS");
      expect((await getSubmissionDetail(actor(w.u.ownerMember), s.id, tx)).capture).toMatchObject({ verified: false, reason: "the signature does not match the stored files" });
      await tx.update(evidenceSubmission).set({ status: "APPROVED" }).where(eq(evidenceSubmission.id, s.id));
      expect((await getPublicProof(s.id, tx)).capture).toBeNull();
      // and no signature at all is simply none
      const plain = await upload(tx, w, store, 8340);
      await finalizeSubmission(actor(w.u.ownerMember), plain.id, { files: plain.files, attestation: { kind: "device-key", publicKey: "x", signature: "y", signedAt: "no" } }, tx, store.port);
      expect((await getSubmissionDetail(actor(w.u.ownerMember), plain.id, tx)).capture).toBeNull();
      expect(await tx.select({ n: evidenceFile.id }).from(evidenceFile).where(eq(evidenceFile.submissionId, plain.id))).toHaveLength(2);
    }));
});
