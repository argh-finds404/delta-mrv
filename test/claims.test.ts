// The claim check (claims.v1): a project's own number against its own boundary. Deterministic and
// explainable: the arithmetic is in the reason, the thresholds are named constants.
import { describe, expect, it } from "vitest";
import { AREA_TOLERANCE, checkClaim, claimFinding, MAX_PLANTS_PER_M2, unitKind } from "../src/lib/forensics/claims";

const HA = 10_000;

describe("what a unit measures", () => {
  it("knows area units and plant counts, and leaves everything else alone", () => {
    for (const u of ["ha", "hectares", "Hectare", "acres", "km²", "sq km", "square metres", "m2"]) expect(unitKind(u)?.kind).toBe("area");
    for (const u of ["saplings", "mangrove saplings", "trees planted", "seedlings", "propagules", "Plants"]) expect(unitKind(u)?.kind).toBe("plants");
    for (const u of ["kg of plastic", "households", "", null]) expect(unitKind(u)).toBeNull();
  });
});

describe("an area claim", () => {
  it("passes when the claimed area fits in the boundary, with a small allowance for drawing", () => {
    expect(checkClaim(3, "hectares", 3.4 * HA)).toMatchObject({ kind: "area", exceeds: false });
    expect(checkClaim(3.5, "ha", 3.4 * HA)).toMatchObject({ kind: "area", exceeds: false }); // within AREA_TOLERANCE
    expect(AREA_TOLERANCE).toBe(1.05);
  });

  it("flags a claim larger than the drawn boundary, and says by how much", () => {
    const c = checkClaim(12, "hectares", 3.4 * HA);
    expect(c).toMatchObject({ kind: "area", exceeds: true });
    const f = claimFinding(c)!;
    expect(f).toMatchObject({ kind: "CLAIM_EXCEEDS_AREA", severity: "MEDIUM" });
    expect(f.reason).toBe("The claim is 12 hectares, but the registered boundary covers 3.4 hectares: 3.5 times the area that was drawn.");
  });

  it("converts acres before comparing", () => {
    expect(checkClaim(10, "acres", 4 * HA)).toMatchObject({ kind: "area", exceeds: false }); // 10 acres = 4.05 ha
    expect(checkClaim(20, "acres", 4 * HA)).toMatchObject({ kind: "area", exceeds: true });
  });
});

describe("a plant count", () => {
  it("records an ordinary density as INFO, with the arithmetic", () => {
    const f = claimFinding(checkClaim(12_000, "saplings", 4.2 * HA))!;
    expect(f).toMatchObject({ kind: "CLAIM_CHECKED", severity: "INFO" });
    expect(f.reason).toBe("12,000 saplings over 4.2 hectares is about 2,857 per hectare (0.29 per square metre).");
  });

  it("flags more plants per square metre than even the densest planting methods use", () => {
    expect(MAX_PLANTS_PER_M2).toBe(5);
    const c = checkClaim(12_000, "saplings", 0.12 * HA);
    expect(c).toMatchObject({ kind: "plants", implausible: true });
    const f = claimFinding(c)!;
    expect(f).toMatchObject({ kind: "CLAIM_DENSITY_IMPLAUSIBLE", severity: "MEDIUM" });
    expect(f.reason).toMatch(/^12,000 saplings over 0\.12 hectares is about 100,000 per hectare \(10 per square metre\)/);
    expect(f.evidence).toMatchObject({ perHectare: 100_000, maxPerSquareMetre: 5, ruleVersion: "claims.v1" });
  });

  it("checks nothing it cannot measure: no number, an unknown unit, no boundary", () => {
    expect(claimFinding(checkClaim(null, "saplings", HA))).toBeNull();
    expect(claimFinding(checkClaim(500, "kg of plastic", HA))).toBeNull();
    expect(claimFinding(checkClaim(500, "saplings", 0))).toBeNull();
  });
});
