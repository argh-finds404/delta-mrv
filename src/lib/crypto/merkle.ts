// FROZEN CONTRACT (docs/02-ARCHITECTURE.md §4.6, ADR-0005), awaiting the maintainer's approval.
// One leaf per approved manifest, [submissionIdBytes32, manifestHashBytes32, approvedTimestamp],
// in ascending submissionId order, as OpenZeppelin's StandardMerkleTree, whose double-hashed
// leaves the Solidity MerkleProof verifier checks. Node, browser and Solidity must agree forever.
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

export const LEAF_ENCODING = ["bytes32", "bytes32", "uint256"] as const;
export type Leaf = [submissionId: `0x${string}`, manifestHash: `0x${string}`, approvedTimestamp: bigint];

/** A UUID's 16 bytes, left-padded with zeros to 32, as Solidity's bytes32(uint256(uint128(id))). */
export function uuidToBytes32(uuid: string): `0x${string}` {
  const hex = uuid.toLowerCase().replaceAll("-", "");
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error("not a UUID");
  return `0x${"0".repeat(32)}${hex}`;
}

export function hashToBytes32(hex64: string): `0x${string}` {
  if (!/^[0-9a-f]{64}$/.test(hex64)) throw new Error("not 64 lowercase hex characters");
  return `0x${hex64}`;
}

/** Whole seconds since the epoch, as Solidity measures time; the ISO string must carry milliseconds and Z. */
export function approvedTimestamp(approvedAtIso: string): bigint {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(approvedAtIso)) throw new Error("approvedAtIso must be ISO 8601 UTC with milliseconds and Z");
  return BigInt(Math.floor(Date.parse(approvedAtIso) / 1000));
}

export function merkleLeaf(submissionId: string, manifestHashHex: string, approvedAtIso: string): Leaf {
  return [uuidToBytes32(submissionId), hashToBytes32(manifestHashHex), approvedTimestamp(approvedAtIso)];
}

/**
 * The tree, from leaves in ascending submissionId (their bytes32 compare as the UUIDs do). The
 * library's own leaf sorting is switched off: the order is the contract's, reproducible by
 * anyone from the public API.
 */
export function buildMerkleTree(leaves: Leaf[]) {
  const ordered = [...leaves].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (let i = 1; i < ordered.length; i++) if (ordered[i]![0] === ordered[i - 1]![0]) throw new Error("a submission appears twice in one batch");
  return StandardMerkleTree.of(ordered, [...LEAF_ENCODING], { sortLeaves: false });
}
