// X2 (docs/01-FEATURE-LOCK.md): what a field device signs when it sends a before/after pair, so
// the server and a stranger's browser can both check the signature. Isomorphic and fixed: a
// change here is a new schema version, never an edit, or every stored signature stops verifying.
// Not part of the anchored manifest (src/lib/crypto/, frozen): it is metadata beside it.
import { canonicalJson } from "./crypto/manifest";

export const CAPTURE_SCHEMA = "delta.capture.v1";

export type CapturedFile = { role: "BEFORE" | "AFTER"; sha256: string };

/**
 * The signed bytes: RFC 8785 JSON of the schema, the project, the two fingerprints (BEFORE then
 * AFTER) and the device's clock at signing. The device's clock is its own claim, not a fact.
 */
export function captureStatement(projectId: string, files: readonly CapturedFile[], signedAt: string): string {
  const order = { BEFORE: 0, AFTER: 1 } as const;
  return canonicalJson({
    schema: CAPTURE_SCHEMA,
    projectId,
    files: [...files].sort((a, b) => order[a.role] - order[b.role]).map((f) => ({ role: f.role, sha256: f.sha256 })),
    signedAt,
  });
}

/** What a device sends with finalize. Base64url SPKI public key, base64url IEEE P1363 (r || s) signature. */
export type CaptureSignature = { kind: "device-key"; publicKey: string; signature: string; signedAt: string };

export const toBase64Url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export const fromBase64Url = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/** Checks a signature with WebCrypto: in the browser on the proof page, and in tests. */
export async function verifyCaptureSignature(statement: string, sig: Pick<CaptureSignature, "publicKey" | "signature">): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("spki", fromBase64Url(sig.publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, fromBase64Url(sig.signature), new TextEncoder().encode(statement));
  } catch {
    return false; // not a P-256 key, or not a signature: it does not verify
  }
}
