// The offline proof file (delta.proof-bundle.v1): everything a stranger needs to recheck a record
// years later with no Delta server: the sealed manifest, its Merkle path to the anchored root, the
// contract to ask, and the device signature. These tests build a real two-record batch.
import { describe, expect, it } from "vitest";
import { captureStatement, toBase64Url } from "../src/lib/capture-statement";
import { buildManifest, manifestHash, type Manifest } from "../src/lib/crypto/manifest";
import { buildMerkleTree, merkleLeaf } from "../src/lib/crypto/merkle";
import { BUNDLE_FORMAT, chainStep, type ProofBundle, verifyBundleOffline } from "../src/lib/proof-bundle";

const ID = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const CONTRACT = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const SIGNED_AT = "2026-11-14T08:30:00.000Z";

function manifestFor(submissionId: string): Manifest {
  return buildManifest({
    submissionId,
    projectId: ID(2),
    ownerOrgId: ID(3),
    verifierOrgId: ID(4),
    files: [
      { role: "AFTER", round: 1, sha256: "b".repeat(64), dhash: null },
      { role: "BEFORE", round: 1, sha256: "a".repeat(64), dhash: "0".repeat(64) },
    ],
    locationCommitment: "c".repeat(64),
    fuzzedLocation: { type: "Point", coordinates: [89.25, 22.35] },
    approvedAtIso: "2026-11-14T09:00:00.000Z",
    quorumReviewIds: [ID(5), ID(6)],
    orgAuditChainHead: "d".repeat(64),
  });
}

async function bundle(opts: { sign?: boolean } = {}): Promise<ProofBundle> {
  const manifest = manifestFor(ID(1));
  const hash = await manifestHash(manifest);
  const other = manifestFor(ID(7));
  const tree = buildMerkleTree([merkleLeaf(ID(1), hash, manifest.approvedAtIso), merkleLeaf(ID(7), await manifestHash(other), other.approvedAtIso)]);
  const index = [...tree.entries()].find(([, v]) => v[0].endsWith(ID(1).replaceAll("-", "")))![0];
  let capture: ProofBundle["capture"] = null;
  if (opts.sign) {
    const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
    const statement = captureStatement(ID(2), [{ role: "BEFORE", sha256: "a".repeat(64) }, { role: "AFTER", sha256: "b".repeat(64) }], SIGNED_AT);
    const signature = toBase64Url(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, new TextEncoder().encode(statement)));
    capture = { publicKey: toBase64Url(await crypto.subtle.exportKey("spki", keys.publicKey)), signature, signedAt: SIGNED_AT };
  }
  return {
    format: BUNDLE_FORMAT,
    exportedAt: "2026-11-15T10:00:00.000Z",
    verifyUrl: "https://delta.example/proof/" + ID(1),
    record: { submissionId: ID(1), projectId: ID(2), projectTitle: "Koyra Mangrove Belt", ownerOrgName: "Sundarbans Restoration Trust", claim: "12,000 saplings", checkupOf: null },
    manifest,
    manifestHash: hash,
    anchor: { chainId: 84532, contractAddress: CONTRACT, batchId: 7, merkleRoot: tree.root, proof: tree.getProof(index), txHash: null, blockNumber: 12, status: "CONFIRMED" },
    capture,
    decisions: [],
  };
}

const states = (steps: { id: string; state: string }[]) => Object.fromEntries(steps.map((s) => [s.id, s.state]));

describe("checking a proof file offline", () => {
  it("passes every step for an untouched file: the fingerprint, the batch path and the device signature", async () => {
    const b = await bundle({ sign: true });
    const out = await verifyBundleOffline(JSON.parse(JSON.stringify(b)));
    expect(states(out.steps)).toEqual({ file: "pass", fingerprint: "pass", batch: "pass", device: "pass" });
  });

  it("catches an edited record, even when the stated fingerprint was edited to match", async () => {
    const b = await bundle();
    const edited = { ...b, manifest: { ...b.manifest, approvedAtIso: "2026-11-13T09:00:00.000Z" } };
    expect(states((await verifyBundleOffline(edited)).steps).fingerprint).toBe("fail");
    const consistent = { ...edited, manifestHash: await manifestHash(edited.manifest as Manifest) };
    const out = states((await verifyBundleOffline(consistent)).steps);
    expect(out.fingerprint).toBe("pass");
    expect(out.batch).toBe("fail"); // the edited record is not a leaf of the anchored root
  });

  it("fails a device signature over different fingerprints, and skips what a file does not carry", async () => {
    const b = await bundle({ sign: true });
    const forged = { ...b, capture: { ...b.capture!, signedAt: "2026-11-14T08:31:00.000Z" } };
    expect(states((await verifyBundleOffline(forged)).steps).device).toBe("fail");
    const bare = { ...(await bundle()), anchor: null };
    expect(states((await verifyBundleOffline(bare)).steps)).toEqual({ file: "pass", fingerprint: "pass", batch: "skip", device: "skip" });
  });

  it("refuses something that is not a proof file, saying why", async () => {
    for (const raw of [null, { format: "something.else" }, { ...(await bundle()), manifestHash: "nope" }]) {
      const out = await verifyBundleOffline(raw);
      expect(out.steps).toHaveLength(1);
      expect(out.steps[0]).toMatchObject({ id: "file", state: "fail" });
    }
  });
});

describe("asking the chain", () => {
  it("passes only when Delta's own registry holds the same root for the batch", async () => {
    const b = await bundle();
    const read = async () => ({ merkleRoot: b.anchor!.merkleRoot, anchoredAt: BigInt(1763100000) });
    expect((await chainStep(b, { registry: CONTRACT, read })).state).toBe("pass");
    expect((await chainStep(b, { registry: CONTRACT, read: async () => ({ merkleRoot: `0x${"0".repeat(64)}`, anchoredAt: BigInt(0) }) })).state).toBe("fail");
    expect((await chainStep(b, { registry: CONTRACT, read: async () => ({ merkleRoot: `0x${"e".repeat(64)}`, anchoredAt: BigInt(1) }) })).state).toBe("fail");
  });

  it("will not ask a contract the file names if it is not Delta's registry, and reports a dead network as unavailable", async () => {
    const b = await bundle();
    const out = await chainStep(b, { registry: "0x0000000000000000000000000000000000000001", read: async () => ({ merkleRoot: b.anchor!.merkleRoot, anchoredAt: BigInt(1) }) });
    expect(out).toMatchObject({ state: "fail" });
    expect(out.detail).toMatch(/not Delta's registry/);
    const down = await chainStep(b, {
      registry: CONTRACT,
      read: async () => {
        throw new Error("fetch failed");
      },
    });
    expect(down.state).toBe("unavailable");
  });
});
