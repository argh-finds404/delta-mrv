// Content Credentials (C2PA) reader (docs/10-FORENSICS.md, X9): reads a JUMBF manifest when a
// camera or tool embedded one, verifies its claim signature and image data hash, and treats a
// missing manifest as ordinary (most cameras do not sign photos yet).
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { toLabFinding } from "../src/components/lab/to-lab-finding";
import { classifyReaderError, parseC2paManifestStore, type C2paRead, type C2paReadResult } from "../src/lib/forensics/c2pa";
import { C2PA_RULE_VERSION, c2paFinding, readC2pa } from "../src/server/forensics/c2pa";

const SIGNED_JPEG = new Uint8Array(readFileSync(path.join(process.cwd(), "test/fixtures/forensics/c2pa-signed.jpg")));
const REMOTE_JPEG = new Uint8Array(readFileSync(path.join(process.cwd(), "test/fixtures/forensics/c2pa-remote.jpg")));

/** The reader ran: a test server always has the WebAssembly. */
function ran(r: C2paReadResult): C2paRead {
  if (r.outcome === "unavailable") throw new Error("the C2PA reader did not load");
  return r;
}

/** A manifest store as the reader reports it, with the parts a test varies. */
const store = (state: string, opts: { failure?: string[]; success?: string[] } = {}) =>
  JSON.stringify({
    active_manifest: "urn:test",
    manifests: { "urn:test": { claim_generator: "camera/1.0", signature_info: { alg: "Es256", issuer: "Camera Maker CA", common_name: "Camera 42" } } },
    validation_state: state,
    validation_results: { activeManifest: { success: (opts.success ?? []).map((code) => ({ code })), failure: (opts.failure ?? []).map((code) => ({ code, explanation: code })) } },
  });

describe("Content Credentials (c2pa.v1)", () => {
  it("reads a valid C2PA-signed JPEG and verifies its claim signature and data hash", async () => {
    const res = ran(await readC2pa(SIGNED_JPEG, "image/jpeg"));
    expect(res.outcome).toBe("valid");
    if (res.outcome !== "valid") return;
    expect(res.signer).toBe("C2PA Signer");
    expect(res.issuer).toBe("C2PA Test Signing Cert");
    expect(res.alg).toBe("Ps256");
    expect(res.claimGenerator).toContain("c2pa-rs");
    expect(res.actions).toContain("c2pa.created");
    expect(res.failureCodes).toEqual([]);

    const f = c2paFinding(res);
    expect(f.kind).toBe("CONTENT_CREDENTIALS");
    expect(f.severity).toBe("INFO");
    expect(f.reason).toContain("Signed Content Credentials from C2PA Signer");
    expect(f.evidence).toMatchObject({
      ruleVersion: C2PA_RULE_VERSION,
      c2pa: {
        outcome: "valid",
        signer: "C2PA Signer",
        issuer: "C2PA Test Signing Cert",
        alg: "Ps256",
      },
    });
  });

  it("flags a C2PA-signed JPEG whose image bytes were altered after signing as invalid", async () => {
    const tampered = new Uint8Array(SIGNED_JPEG);
    tampered[tampered.length - 20]! ^= 0xff;

    const res = ran(await readC2pa(tampered, "image/jpeg"));
    expect(res.outcome).toBe("invalid");
    if (res.outcome !== "invalid") return;
    expect(res.failureCodes).toContain("assertion.dataHash.mismatch");

    const f = c2paFinding(res);
    expect(f.kind).toBe("CONTENT_CREDENTIALS");
    expect(f.severity).toBe("INFO");
    expect(f.reason).toContain("did not verify");
    expect(f.reason).toContain("assertion.dataHash.mismatch");
    expect(f.evidence).toMatchObject({
      ruleVersion: C2PA_RULE_VERSION,
      c2pa: {
        outcome: "invalid",
        failureCodes: ["assertion.dataHash.mismatch"],
      },
    });
  });

  it("reports absent (and never penalises the photo) when a JPEG or PNG carries no C2PA manifest", async () => {
    const unsignedJpg = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 30, g: 110, b: 60 } },
    })
      .jpeg()
      .toBuffer();

    const res = ran(await readC2pa(new Uint8Array(unsignedJpg), "image/jpeg"));
    expect(res).toEqual({ outcome: "absent" });

    const f = c2paFinding(res);
    expect(f.kind).toBe("CONTENT_CREDENTIALS");
    expect(f.severity).toBe("INFO");
    expect(f.reason).toContain("no Content Credentials (C2PA)");
    expect(f.evidence).toEqual({
      c2pa: { outcome: "absent" },
      ruleVersion: C2PA_RULE_VERSION,
    });

    const labAbsent = toLabFinding({ id: "f-absent", ...f, ruleVersion: C2PA_RULE_VERSION });
    expect(labAbsent.kind).toBe("CONTENT_CREDENTIALS");
    expect(labAbsent.evidence.c2pa).toEqual({ outcome: "absent" });

    const validRes = ran(await readC2pa(SIGNED_JPEG, "image/jpeg"));
    const labValid = toLabFinding(
      { id: "f-valid", evidenceFileId: "file-1", ...c2paFinding(validRes), ruleVersion: C2PA_RULE_VERSION },
      [{ id: "file-1", role: "BEFORE" }],
    );
    expect(labValid.subject).toBe("Before photo");
    expect(labValid.evidence.c2pa).toMatchObject({
      outcome: "valid",
      signer: "C2PA Signer",
      issuer: "C2PA Test Signing Cert",
    });
  });
});

describe("the reader never reaches the network (c2pa.v1)", () => {
  it("records a photo that names a remote manifest as remote, without fetching it", async () => {
    // a photo can name any address as its manifest's home, an internal one included
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("the reader must not fetch"));
    try {
      const res = ran(await readC2pa(REMOTE_JPEG, "image/jpeg"));
      expect(res).toEqual({ outcome: "remote", host: "cai-manifests.adobe.com" });
      expect(fetchSpy).not.toHaveBeenCalled();
      const f = c2paFinding(res);
      expect(f).toMatchObject({ kind: "CONTENT_CREDENTIALS", severity: "INFO", evidence: { c2pa: { outcome: "remote", host: "cai-manifests.adobe.com" } } });
      expect(f.reason).toBe("The photo points to Content Credentials stored at cai-manifests.adobe.com. Delta never fetches a remote manifest, so they were not checked.");
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe("what a reader error means", () => {
  it("tells no manifest apart from a manifest held elsewhere and from C2PA data that cannot be read", () => {
    expect(classifyReaderError("C2pa(JumbfNotFound)")).toEqual({ outcome: "absent" });
    expect(classifyReaderError('C2pa(RemoteManifestUrl("https://example.org/m/1"))')).toEqual({ outcome: "remote", host: "example.org" });
    expect(classifyReaderError('C2pa(RemoteManifestFetch("error sending request"))')).toEqual({ outcome: "remote", host: null });
    expect(classifyReaderError('C2pa(InvalidAsset("Could not parse input JPEG"))')).toEqual({ outcome: "unreadable", code: "InvalidAsset" });
    expect(classifyReaderError("RuntimeError: unreachable")).toEqual({ outcome: "unreadable", code: "ReaderError" });
    expect(c2paFinding({ outcome: "unreadable", code: "InvalidAsset" }).reason).toBe("The photo carries Content Credentials (C2PA) data that could not be read (InvalidAsset).");
  });
});

describe("the verdict on a manifest store", () => {
  it("counts a certificate on the trust list as valid, and says so", () => {
    const res = parseC2paManifestStore(store("Trusted"));
    expect(res).toMatchObject({ outcome: "valid", trusted: true, signer: "Camera 42" });
    expect(c2paFinding(res).reason).toContain("a certificate on the C2PA trust list");
  });

  it("does not let today's date decide a signature that carries no trusted time", () => {
    // without a timestamp the certificate is judged at the moment of reading, so the verdict would
    // change once it expires: a replay must give the same answer for the same bytes
    const untimed = parseC2paManifestStore(store("Invalid", { failure: ["signingCredential.expired"] }));
    expect(untimed).toMatchObject({ outcome: "valid", trustedTime: false, failureCodes: [] });
    expect(c2paFinding(untimed).reason).toContain("carries no trusted timestamp");
    // with a trusted timestamp the certificate is judged at signing time, so expiry then is a real failure
    const timed = parseC2paManifestStore(store("Invalid", { failure: ["signingCredential.expired"], success: ["timeStamp.validated"] }));
    expect(timed).toMatchObject({ outcome: "invalid", trustedTime: true, failureCodes: ["signingCredential.expired"] });
  });

  it("keeps a broken signature or hash invalid, whatever the time", () => {
    expect(parseC2paManifestStore(store("Invalid", { failure: ["claimSignature.mismatch"] }))).toMatchObject({ outcome: "invalid", failureCodes: ["claimSignature.mismatch"] });
    expect(parseC2paManifestStore(store("Valid", { failure: ["signingCredential.untrusted"] }))).toMatchObject({ outcome: "valid", trusted: false, failureCodes: [] });
  });
});
