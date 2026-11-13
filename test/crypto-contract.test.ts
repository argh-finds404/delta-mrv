// The frozen cross-runtime contract (docs/02-ARCHITECTURE.md §4.4, §4.6, ADR-0005) against
// known-answer vectors made independently of this code: a hand-written canonical string hashed
// with sha256sum, and Merkle roots from viem's keccak and ABI encoding.
import { describe, expect, it } from "vitest";
import { buildManifest, canonicalJson, manifestHash, MANIFEST_SCHEMA, type Manifest } from "../src/lib/crypto/manifest";
import { approvedTimestamp, buildMerkleTree, merkleLeaf, uuidToBytes32 } from "../src/lib/crypto/merkle";
import vectors from "./fixtures/crypto/vectors.json";

const input = vectors.manifest.input as Omit<Manifest, "schema">;

describe("canonical manifest (delta.manifest.v2)", () => {
  it("serialises to the hand-written canonical string and hashes to its sha256sum", async () => {
    const m = buildManifest(input);
    expect(m.schema).toBe(MANIFEST_SCHEMA);
    expect(canonicalJson(m)).toBe(vectors.manifest.canonical);
    expect(await manifestHash(m)).toBe(vectors.manifest.sha256);
  });

  it("orders files BEFORE, AFTER, SUPPLEMENT, then round, then sha256, whatever order they arrive in", () => {
    const shuffled = { ...input, files: [...input.files].reverse() };
    expect(buildManifest(shuffled).files.map((f) => f.role)).toEqual(["BEFORE", "AFTER", "SUPPLEMENT"]);
    const tie = buildManifest({
      ...input,
      files: [
        { role: "SUPPLEMENT", round: 3, sha256: "2".repeat(64), dhash: null },
        { role: "SUPPLEMENT", round: 2, sha256: "9".repeat(64), dhash: null },
        { role: "SUPPLEMENT", round: 2, sha256: "1".repeat(64), dhash: null },
        { role: "BEFORE", round: 1, sha256: "f".repeat(64), dhash: null },
      ],
    }).files;
    expect(tie.map((f) => [f.role, f.round, f.sha256[0]])).toEqual([["BEFORE", 1, "f"], ["SUPPLEMENT", 2, "1"], ["SUPPLEMENT", 2, "9"], ["SUPPLEMENT", 3, "2"]]);
  });

  it("every file entry carries exactly four keys, with dhash null rather than absent", () => {
    const m = buildManifest({ ...input, files: [{ role: "BEFORE", round: 1, sha256: "a".repeat(64), dhash: null, extra: 1 } as never] });
    expect(m.files).toEqual([{ role: "BEFORE", round: 1, sha256: "a".repeat(64), dhash: null }]);
    expect(canonicalJson(m.files[0])).toContain('"dhash":null');
  });

  it("refuses what would make an unverifiable manifest", () => {
    for (const bad of [
      { ...input, approvedAtIso: "2026-11-10T09:30:00Z" }, // no milliseconds
      { ...input, approvedAtIso: "2026-11-10T09:30:00.123+00:00" }, // offset notation
      { ...input, submissionId: "AAAAAAAA-1111-4111-8111-111111111111" }, // ids are lowercase
      { ...input, files: [] },
      { ...input, files: [{ role: "BEFORE" as const, round: 1, sha256: "A".repeat(64), dhash: null }] },
      { ...input, files: [{ role: "BEFORE" as const, round: 0, sha256: "a".repeat(64), dhash: null }] },
      { ...input, files: [{ role: "BEFORE" as const, round: 1, sha256: "a".repeat(64), dhash: "" }] },
    ]) {
      expect(() => buildManifest(bad)).toThrow();
    }
  });
});

describe("Merkle leaves", () => {
  it("encodes a leaf as [bytes32 id, bytes32 manifest hash, uint256 seconds]", () => {
    const [l] = vectors.merkle.leaves;
    expect(uuidToBytes32(l!.submissionId)).toBe(`0x${l!.bytes32}`);
    expect(approvedTimestamp(l!.approvedAtIso)).toBe(BigInt(l!.timestamp));
  });

  it("builds the roots the independent implementation computed, in ascending submissionId order", () => {
    const leaves = vectors.merkle.leaves.map((l) => merkleLeaf(l.submissionId, l.manifestHash, l.approvedAtIso));
    expect(buildMerkleTree([leaves[0]!]).root).toBe(`0x${vectors.merkle.oneLeafRoot}`);
    expect(buildMerkleTree(leaves).root).toBe(`0x${vectors.merkle.twoLeafRoot}`);
    // input order does not matter: the contract fixes it
    expect(buildMerkleTree([...leaves].reverse()).root).toBe(`0x${vectors.merkle.twoLeafRoot}`);
    const tree = buildMerkleTree(leaves);
    for (const [i, v] of tree.entries()) expect(tree.verify(v, tree.getProof(i))).toBe(true);
  });

  it("a submission cannot appear twice in one batch", () => {
    const l = vectors.merkle.leaves[0]!;
    const leaf = merkleLeaf(l.submissionId, l.manifestHash, l.approvedAtIso);
    expect(() => buildMerkleTree([leaf, leaf])).toThrow(/twice/);
  });
});
