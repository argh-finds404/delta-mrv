// FROZEN CONTRACT (docs/02-ARCHITECTURE.md §4.4, ADR-0005), awaiting the maintainer's approval.
// The canonical evidence manifest and its hash: computed by the server when anchoring and by a
// stranger's browser when verifying, so both must produce identical bytes forever. Changing a
// field, its order, a key or the timestamp format is a new schema version, never an edit.
import canonicalize from "canonicalize";

export const MANIFEST_SCHEMA = "delta.manifest.v2";

export type ManifestRole = "BEFORE" | "AFTER" | "SUPPLEMENT";
/** Exactly these four keys, always; `dhash` is JSON null when there is none. */
export type ManifestFile = { role: ManifestRole; round: number; sha256: string; dhash: string | null };

export type Manifest = {
  schema: typeof MANIFEST_SCHEMA;
  submissionId: string;
  projectId: string;
  ownerOrgId: string;
  verifierOrgId: string;
  files: ManifestFile[];
  locationCommitment: string | null;
  fuzzedLocation: { type: "Point"; coordinates: [number, number] } | null;
  approvedAtIso: string;
  quorumReviewIds: string[];
  orgAuditChainHead: string | null;
};

const ROLE_ORDER: Record<ManifestRole, number> = { BEFORE: 0, AFTER: 1, SUPPLEMENT: 2 };
const ISO_MS_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const HEX64 = /^[0-9a-f]{64}$/;
const BITS64 = /^[01]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** BEFORE, AFTER, SUPPLEMENT (this order, not alphabetical), then round, then sha256. */
export function compareManifestFiles(a: ManifestFile, b: ManifestFile): number {
  return ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.round - b.round || (a.sha256 < b.sha256 ? -1 : a.sha256 > b.sha256 ? 1 : 0);
}

/** RFC 8785 canonical JSON. Never JSON.stringify for anything that is hashed. */
export function canonicalJson(value: unknown): string {
  const out = canonicalize(value);
  if (out === undefined) throw new Error("value cannot be canonicalised");
  return out;
}

/**
 * The manifest, built from its parts and checked: ids are lowercase UUIDs, hashes lowercase hex,
 * the time ISO 8601 UTC with milliseconds and Z, every file entry exactly four keys, files in
 * the frozen order, review ids ascending. Anything else throws: a wrong manifest is never anchored.
 */
export function buildManifest(input: Omit<Manifest, "schema">): Manifest {
  for (const [k, v] of [["submissionId", input.submissionId], ["projectId", input.projectId], ["ownerOrgId", input.ownerOrgId], ["verifierOrgId", input.verifierOrgId]] as const) {
    if (!UUID.test(v)) throw new Error(`${k} must be a lowercase UUID`);
  }
  if (!ISO_MS_Z.test(input.approvedAtIso)) throw new Error("approvedAtIso must be ISO 8601 UTC with milliseconds and Z");
  if (input.locationCommitment !== null && !HEX64.test(input.locationCommitment)) throw new Error("locationCommitment must be 64 lowercase hex characters or null");
  if (input.orgAuditChainHead !== null && !HEX64.test(input.orgAuditChainHead)) throw new Error("orgAuditChainHead must be 64 lowercase hex characters or null");
  if (!input.files.length) throw new Error("a manifest commits to at least one file");
  const files = input.files.map((f): ManifestFile => {
    if (!(f.role in ROLE_ORDER)) throw new Error(`unknown file role ${String(f.role)}`);
    if (!Number.isInteger(f.round) || f.round < 1) throw new Error("file round must be a positive integer");
    if (!HEX64.test(f.sha256)) throw new Error("file sha256 must be 64 lowercase hex characters");
    if (f.dhash !== null && !BITS64.test(f.dhash)) throw new Error("file dhash must be 64 bits of 0/1, or null");
    return { role: f.role, round: f.round, sha256: f.sha256, dhash: f.dhash };
  });
  const quorumReviewIds = [...input.quorumReviewIds].sort();
  for (const id of quorumReviewIds) if (!UUID.test(id)) throw new Error("quorumReviewIds must be lowercase UUIDs");
  return {
    schema: MANIFEST_SCHEMA,
    submissionId: input.submissionId,
    projectId: input.projectId,
    ownerOrgId: input.ownerOrgId,
    verifierOrgId: input.verifierOrgId,
    files: files.sort(compareManifestFiles),
    locationCommitment: input.locationCommitment,
    fuzzedLocation: input.fuzzedLocation,
    approvedAtIso: input.approvedAtIso,
    quorumReviewIds,
    orgAuditChainHead: input.orgAuditChainHead,
  };
}

/** manifestHash = SHA256(utf8(canonicalize(manifest))), lowercase hex. WebCrypto: Node and browser alike. */
export async function manifestHash(manifest: Manifest): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(manifest)));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
