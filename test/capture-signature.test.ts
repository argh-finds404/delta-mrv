// X2: a device signs its capture's fingerprints with WebCrypto (as the browser does); the server
// checks with node:crypto; a stranger's browser checks again on the proof page. All three agree.
import { describe, expect, it } from "vitest";
import { captureStatement, toBase64Url, verifyCaptureSignature } from "../src/lib/capture-statement";
import { checkCaptureAttestation } from "../src/server/services/capture-attestation";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const FILES = [
  { role: "AFTER" as const, sha256: "b".repeat(64) },
  { role: "BEFORE" as const, sha256: "a".repeat(64) },
];
const SIGNED_AT = "2026-11-14T08:30:00.000Z";

async function device() {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const publicKey = toBase64Url(await crypto.subtle.exportKey("spki", keys.publicKey));
  const sign = async (statement: string) => toBase64Url(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, new TextEncoder().encode(statement)));
  return { publicKey, sign };
}

describe("the capture statement", () => {
  it("is canonical JSON with the fingerprints in a fixed order, whatever order they came in", () => {
    const s = captureStatement(PROJECT, FILES, SIGNED_AT);
    expect(s).toBe(`{"files":[{"role":"BEFORE","sha256":"${"a".repeat(64)}"},{"role":"AFTER","sha256":"${"b".repeat(64)}"}],"projectId":"${PROJECT}","schema":"delta.capture.v1","signedAt":"${SIGNED_AT}"}`);
    expect(captureStatement(PROJECT, [...FILES].reverse(), SIGNED_AT)).toBe(s);
  });
});

describe("a device signature", () => {
  it("made in WebCrypto verifies on the server and in a browser", async () => {
    const d = await device();
    const signature = await d.sign(captureStatement(PROJECT, FILES, SIGNED_AT));
    const stored = checkCaptureAttestation({ kind: "device-key", publicKey: d.publicKey, signature, signedAt: SIGNED_AT }, PROJECT, FILES);
    expect(stored).toMatchObject({ kind: "device-key", alg: "ES256", verified: true, reason: null, signedAt: SIGNED_AT });
    expect(stored!.keyId).toMatch(/^[0-9a-f]{16}$/);
    expect(await verifyCaptureSignature(captureStatement(PROJECT, FILES, SIGNED_AT), { publicKey: d.publicKey, signature })).toBe(true);
  });

  it("does not verify against files that differ from what was signed, nor another project or time", async () => {
    const d = await device();
    const sig = { kind: "device-key", publicKey: d.publicKey, signature: await d.sign(captureStatement(PROJECT, FILES, SIGNED_AT)), signedAt: SIGNED_AT };
    const changed = [{ role: "BEFORE" as const, sha256: "c".repeat(64) }, FILES[0]!];
    expect(checkCaptureAttestation(sig, PROJECT, changed)).toMatchObject({ verified: false, reason: "the signature does not match the stored files" });
    expect(checkCaptureAttestation(sig, "22222222-2222-4222-8222-222222222222", FILES)!.verified).toBe(false);
    expect(checkCaptureAttestation({ ...sig, signedAt: "2026-11-14T08:31:00.000Z" }, PROJECT, FILES)!.verified).toBe(false);
    expect(await verifyCaptureSignature(captureStatement(PROJECT, changed, SIGNED_AT), sig)).toBe(false);
  });

  it("is ignored when malformed, and refused when the key is not P-256", async () => {
    expect(checkCaptureAttestation(undefined, PROJECT, FILES)).toBeNull();
    expect(checkCaptureAttestation({ kind: "device-key", publicKey: "short", signature: "x", signedAt: "yesterday" }, PROJECT, FILES)).toBeNull();
    const p384 = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-384" }, true, ["sign", "verify"]);
    const publicKey = toBase64Url(await crypto.subtle.exportKey("spki", p384.publicKey));
    const signature = toBase64Url(new Uint8Array(64).fill(1));
    expect(checkCaptureAttestation({ kind: "device-key", publicKey, signature, signedAt: SIGNED_AT }, PROJECT, FILES)).toMatchObject({ verified: false, reason: "the key is not an ECDSA P-256 key" });
    expect(await verifyCaptureSignature("anything", { publicKey, signature })).toBe(false);
  });

  it("records a key or signature that is not valid base64 as unverified, never throwing out of finalize", () => {
    // 41 and 61 characters pass the shape check, but no base64 text has a length of 4n + 1
    const bad = { kind: "device-key", publicKey: "A".repeat(41), signature: "A".repeat(64), signedAt: SIGNED_AT };
    expect(checkCaptureAttestation(bad, PROJECT, FILES)).toMatchObject({ verified: false, reason: "the public key could not be read" });
    expect(checkCaptureAttestation({ ...bad, publicKey: "A".repeat(44), signature: "A".repeat(61) }, PROJECT, FILES)).toMatchObject({ verified: false });
  });
});
