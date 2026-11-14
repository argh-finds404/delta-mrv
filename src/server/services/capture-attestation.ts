import "server-only";
import { createHash, createPublicKey, verify } from "node:crypto";
import { z } from "zod";
import { captureStatement, type CapturedFile } from "../../lib/capture-statement";

// X2: the device signature sent with finalize, checked against the fingerprints the server
// computed from the stored bytes. Additive and never blocking: no signature, a malformed one or
// one that fails is recorded as such, and the submission proceeds exactly as without it.

export const captureSignatureSchema = z.object({
  kind: z.literal("device-key"),
  publicKey: z.string().regex(/^[A-Za-z0-9_-]{40,200}$/),
  signature: z.string().regex(/^[A-Za-z0-9_-]{60,120}$/),
  signedAt: z.iso.datetime(),
});

export type StoredAttestation = {
  kind: "device-key";
  alg: "ES256";
  /** First 16 hex characters of SHA-256 over the public key: the same device signs under the same id. */
  keyId: string;
  publicKey: string;
  signature: string;
  /** The device's clock: its claim, not a fact. */
  signedAt: string;
  verified: boolean;
  reason: string | null;
};

/** Verifies `raw` against the stored files' fingerprints. Null when nothing (valid in shape) was sent. */
export function checkCaptureAttestation(raw: unknown, projectId: string, files: readonly CapturedFile[]): StoredAttestation | null {
  const parsed = captureSignatureSchema.safeParse(raw);
  if (!parsed.success) return null;
  const sig = parsed.data;
  // Buffer's decoder, not atob: atob throws on a length of 4n + 1, which would fail the whole finalize
  const spki = Buffer.from(sig.publicKey, "base64url");
  const base = { kind: "device-key" as const, alg: "ES256" as const, keyId: createHash("sha256").update(spki).digest("hex").slice(0, 16), publicKey: sig.publicKey, signature: sig.signature, signedAt: sig.signedAt };
  let key;
  try {
    key = createPublicKey({ key: spki, format: "der", type: "spki" });
  } catch {
    return { ...base, verified: false, reason: "the public key could not be read" };
  }
  if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") return { ...base, verified: false, reason: "the key is not an ECDSA P-256 key" };
  const ok = verify("sha256", Buffer.from(captureStatement(projectId, files, sig.signedAt)), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(sig.signature, "base64url"));
  return { ...base, verified: ok, reason: ok ? null : "the signature does not match the stored files" };
}
