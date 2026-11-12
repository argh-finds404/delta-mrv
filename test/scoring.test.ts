// scoring.v1 (docs/10-FORENSICS.md §6): a pure function of the findings, versioned, banded.
import { describe, expect, it } from "vitest";
import { SCORING_VERSION, scoreV1, type ScoredFinding } from "../src/lib/scoring/v1";

const f = (severity: ScoredFinding["severity"], kind = "GPS_MISSING"): ScoredFinding => ({ kind, severity });

describe("scoreV1", () => {
  it("weighs INFO 0, LOW 1, MEDIUM 4, HIGH 12, and an AI observation at a quarter", () => {
    expect(scoreV1([]).score).toBe(0);
    expect(scoreV1([f("INFO"), f("LOW"), f("MEDIUM"), f("HIGH")]).score).toBe(17);
    expect(scoreV1([f("LOW", "AI_OBSERVATION"), f("LOW", "AI_OBSERVATION")]).score).toBe(0.5);
  });

  it("bands: under one MEDIUM is clear, under one HIGH is review, a HIGH or more is concern", () => {
    expect(scoreV1([f("LOW"), f("LOW"), f("LOW")]).band).toBe("clear");
    expect(scoreV1([f("MEDIUM")]).band).toBe("review");
    expect(scoreV1([f("MEDIUM"), f("MEDIUM"), f("LOW"), f("LOW"), f("LOW")]).band).toBe("review");
    expect(scoreV1([f("HIGH")]).band).toBe("concern");
    // AI is advisory: fifteen LOW observations still weigh less than one MEDIUM
    expect(scoreV1(Array.from({ length: 15 }, () => f("LOW", "AI_OBSERVATION"))).band).toBe("clear");
  });

  it("is pure: order does not matter, input is not touched, and the version is stamped", () => {
    const input = [f("HIGH"), f("LOW"), f("MEDIUM", "NO_VISIBLE_CHANGE")];
    const frozen = JSON.stringify(input);
    expect(scoreV1(input)).toEqual(scoreV1([...input].reverse()));
    expect(JSON.stringify(input)).toBe(frozen);
    expect(scoreV1(input).version).toBe(SCORING_VERSION);
    expect(SCORING_VERSION).toBe("scoring.v1");
  });
});
