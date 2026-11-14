// The offline proof file, delta.proof-bundle.v1: one JSON document a stranger can keep for a decade
// and recheck with no Delta server and no database. It carries the sealed manifest exactly as
// anchored, the Merkle path from its leaf to the batch root, which contract holds that root, and the
// capturing device's signature. Verification recomputes everything; the stated values are claims.
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { z } from "zod";
import { captureStatement, verifyCaptureSignature, type CapturedFile } from "./capture-statement";
import { manifestHash, MANIFEST_SCHEMA, type Manifest } from "./crypto/manifest";
import { LEAF_ENCODING, merkleLeaf } from "./crypto/merkle";

export const BUNDLE_FORMAT = "delta.proof-bundle.v1";
export const BUNDLE_EXTENSION = ".delta-proof.json";

const HEX64 = /^[0-9a-f]{64}$/;
const BYTES32 = /^0x[0-9a-fA-F]{64}$/;

const bundleSchema = z.object({
  format: z.literal(BUNDLE_FORMAT),
  exportedAt: z.string(),
  verifyUrl: z.string().nullable(),
  record: z.object({
    submissionId: z.string(),
    projectId: z.string(),
    projectTitle: z.string(),
    ownerOrgName: z.string(),
    claim: z.string().nullable(),
    checkupOf: z.string().nullable(),
  }),
  // hashed exactly as it is in the file: never rebuilt or reordered, or an edit could be "repaired"
  manifest: z.looseObject({ schema: z.literal(MANIFEST_SCHEMA), submissionId: z.string(), projectId: z.string(), approvedAtIso: z.string(), files: z.array(z.looseObject({ role: z.enum(["BEFORE", "AFTER", "SUPPLEMENT"]), round: z.number(), sha256: z.string() })) }),
  manifestHash: z.string().regex(HEX64, "manifestHash must be 64 lowercase hex characters"),
  anchor: z
    .object({
      chainId: z.number().int(),
      contractAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
      batchId: z.number().int().nonnegative(),
      merkleRoot: z.string().regex(BYTES32),
      proof: z.array(z.string().regex(BYTES32)),
      txHash: z.string().nullable(),
      blockNumber: z.number().nullable(),
      status: z.string(),
    })
    .nullable(),
  capture: z.object({ publicKey: z.string(), signature: z.string(), signedAt: z.string() }).nullable(),
  decisions: z.array(z.object({ decision: z.string(), reason: z.string(), round: z.number(), createdAt: z.string(), reviewerOrgName: z.string() })),
});

export type ProofBundle = z.infer<typeof bundleSchema> & { manifest: Manifest };

/** What the proof page knows, as the bundle's builder needs it (dates already serialised). */
export type BundleSource = {
  submissionId: string;
  project: { id: string; title: string; ownerOrgName: string };
  claim: string | null;
  checkupOf: string | null;
  manifest: Manifest;
  manifestHash: string;
  anchor: { chainId: number; contractAddress: string; batchId: number; merkleRoot: string; proof: string[]; txHash: string | null; blockNumber: number | null; status: string } | null;
  capture: { publicKey: string; signature: string; signedAt: string } | null;
  decisions: { decision: string; reason: string; round: number; createdAt: string; reviewerOrgName: string }[];
};

export function buildProofBundle(src: BundleSource, verifyUrl: string | null, exportedAt = new Date().toISOString()): ProofBundle {
  return {
    format: BUNDLE_FORMAT,
    exportedAt,
    verifyUrl,
    record: { submissionId: src.submissionId, projectId: src.project.id, projectTitle: src.project.title, ownerOrgName: src.project.ownerOrgName, claim: src.claim, checkupOf: src.checkupOf },
    manifest: src.manifest,
    manifestHash: src.manifestHash,
    anchor: src.anchor,
    capture: src.capture,
    decisions: src.decisions,
  };
}

export type StepState = "pass" | "fail" | "skip" | "unavailable";
export type BundleStep = { id: "file" | "fingerprint" | "batch" | "device" | "chain"; state: StepState; title: string; detail: string };

const shortHex = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

/**
 * The steps that need nothing but the file: it is a proof file, its record hashes to its stated
 * fingerprint, that record is a leaf of the stated batch root, and the device signature (if any)
 * covers the record's own photos. The chain is asked separately (chainStep).
 */
export async function verifyBundleOffline(raw: unknown): Promise<{ bundle: ProofBundle | null; recomputedHash: string | null; steps: BundleStep[] }> {
  const parsed = bundleSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.join(".")})` : "";
    return { bundle: null, recomputedHash: null, steps: [{ id: "file", state: "fail", title: "Not a Delta proof file", detail: `${issue?.message ?? "The file could not be read"}${where}. Download the file again from the record's proof page.` }] };
  }
  const bundle = parsed.data as ProofBundle;
  const steps: BundleStep[] = [{ id: "file", state: "pass", title: "A Delta proof file", detail: `Exported ${bundle.exportedAt.slice(0, 10)} for “${bundle.record.projectTitle}”.` }];

  const hash = await manifestHash(bundle.manifest);
  const sameRecord = bundle.manifest.submissionId === bundle.record.submissionId;
  steps.push(
    hash === bundle.manifestHash && sameRecord
      ? { id: "fingerprint", state: "pass", title: "The record is the one that was sealed", detail: `Your browser hashed the record in the file to ${shortHex(hash)}, the fingerprint the file states.` }
      : { id: "fingerprint", state: "fail", title: "The record in the file was changed", detail: sameRecord ? `It hashes to ${shortHex(hash)}, but the file states ${shortHex(bundle.manifestHash)}.` : "The sealed record names a different submission from the file's header." },
  );

  if (!bundle.anchor) {
    steps.push({ id: "batch", state: "skip", title: "Not in a batch yet", detail: "When this file was exported the record had not been anchored, so only its fingerprint can be checked." });
  } else {
    let inBatch = false;
    try {
      inBatch = StandardMerkleTree.verify(bundle.anchor.merkleRoot, [...LEAF_ENCODING], merkleLeaf(bundle.manifest.submissionId, hash, bundle.manifest.approvedAtIso), bundle.anchor.proof);
    } catch {
      inBatch = false;
    }
    steps.push(
      inBatch
        ? { id: "batch", state: "pass", title: `A leaf of batch ${bundle.anchor.batchId}`, detail: `From the record's own fingerprint, the ${bundle.anchor.proof.length}-step path climbs to the batch root ${shortHex(bundle.anchor.merkleRoot)}.` }
        : { id: "batch", state: "fail", title: `Not a leaf of batch ${bundle.anchor.batchId}`, detail: "The record, as it is in this file, does not climb to the stated batch root. It was changed after it was anchored, or the path belongs to another record." },
    );
  }

  if (!bundle.capture) {
    steps.push({ id: "device", state: "skip", title: "No device signature", detail: "The photos were sent without a device signature. Their fingerprints are still in the sealed record." });
  } else {
    const pair: CapturedFile[] = bundle.manifest.files.filter((f) => f.round === 1 && (f.role === "BEFORE" || f.role === "AFTER")).map((f) => ({ role: f.role as "BEFORE" | "AFTER", sha256: f.sha256 }));
    const ok = await verifyCaptureSignature(captureStatement(bundle.manifest.projectId, pair, bundle.capture.signedAt), bundle.capture);
    steps.push(
      ok
        ? { id: "device", state: "pass", title: "Signed by the capturing device", detail: `The device's key signed these photos' fingerprints, by its own clock at ${bundle.capture.signedAt.slice(0, 16).replace("T", " ")} UTC. The key is held by a browser, not a hardware chip.` }
        : { id: "device", state: "fail", title: "The device signature does not match", detail: "The signature in the file does not cover these photos' fingerprints." },
    );
  }
  return { bundle, recomputedHash: hash, steps };
}

/**
 * The one online step: Delta's own registry contract, asked over any public RPC, holds the same root
 * for the batch. The contract is the registry this site is configured with, never the one the file
 * names: a forger can deploy a contract of their own.
 */
export async function chainStep(
  bundle: ProofBundle,
  opts: { registry: string | null; read: (address: `0x${string}`, batchId: bigint) => Promise<{ merkleRoot: string; anchoredAt: bigint }> },
): Promise<BundleStep> {
  const a = bundle.anchor;
  if (!a) return { id: "chain", state: "skip", title: "Nothing to ask the chain", detail: "The record was not in a batch when this file was exported." };
  if (!opts.registry) return { id: "chain", state: "unavailable", title: "No registry configured", detail: "This copy of Delta has no registry contract configured, so it cannot say which contract to trust." };
  if (a.contractAddress.toLowerCase() !== opts.registry.toLowerCase()) {
    return { id: "chain", state: "fail", title: "The file names another contract", detail: `It points at ${a.contractAddress}, which is not Delta's registry (${opts.registry}). A root held there proves nothing.` };
  }
  try {
    const held = await opts.read(opts.registry as `0x${string}`, BigInt(a.batchId));
    if (/^0x0{64}$/.test(held.merkleRoot)) return { id: "chain", state: "fail", title: `The registry holds no batch ${a.batchId}`, detail: "Nothing is anchored under that number." };
    if (held.merkleRoot.toLowerCase() !== a.merkleRoot.toLowerCase()) return { id: "chain", state: "fail", title: "The registry holds a different root", detail: `Batch ${a.batchId} on chain is ${shortHex(held.merkleRoot)}, not ${shortHex(a.merkleRoot)}.` };
    return { id: "chain", state: "pass", title: "Anchored on Base Sepolia", detail: `Delta's registry holds this root for batch ${a.batchId}, written ${new Date(Number(held.anchoredAt) * 1000).toISOString().slice(0, 10)}.` };
  } catch {
    return { id: "chain", state: "unavailable", title: "The chain could not be reached", detail: "The offline steps above stand on their own; asking the chain needs a connection. Try again later." };
  }
}
