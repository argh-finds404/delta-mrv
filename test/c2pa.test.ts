// Content Credentials (C2PA) reader (docs/10-FORENSICS.md, X9): reads a JUMBF manifest when a
// camera or tool embedded one, verifies its claim signature and image data hash, and treats a
// missing manifest as ordinary (most cameras do not sign photos yet).
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { toLabFinding } from "../src/components/lab/to-lab-finding";
import { C2PA_RULE_VERSION, c2paFinding, readC2pa } from "../src/server/forensics/c2pa";

const SIGNED_JPEG = new Uint8Array(readFileSync(path.join(process.cwd(), "test/fixtures/forensics/c2pa-signed.jpg")));

describe("Content Credentials (c2pa.v1)", () => {
  it("reads a valid C2PA-signed JPEG and verifies its claim signature and data hash", async () => {
    const res = await readC2pa(SIGNED_JPEG, "image/jpeg");
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

    const res = await readC2pa(tampered, "image/jpeg");
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

    const res = await readC2pa(new Uint8Array(unsignedJpg), "image/jpeg");
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

    const validRes = await readC2pa(SIGNED_JPEG, "image/jpeg");
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
