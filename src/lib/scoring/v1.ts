// The derived score (docs/10-FORENSICS.md §6). Pure: no database, no clock, no randomness.
// Changing a weight or a band edge is a new version; old submissions keep the version they
// were scored with. The score is shown as a band beside its findings, and gates nothing.

export const SCORING_VERSION = "scoring.v1";
const WEIGHTS = { INFO: 0, LOW: 1, MEDIUM: 4, HIGH: 12 } as const;
const AI_FACTOR = 0.25;

export type ScoredFinding = { kind: string; severity: keyof typeof WEIGHTS };
export type RiskBand = "clear" | "review" | "concern";

/**
 * Bands read as "worth what": below one MEDIUM's weight is clear (a few missing-metadata
 * LOWs), from one MEDIUM is review, from one HIGH's weight is concern.
 */
export function scoreV1(findings: readonly ScoredFinding[]): { score: number; band: RiskBand; version: typeof SCORING_VERSION } {
  const score = findings.reduce((sum, f) => sum + WEIGHTS[f.severity] * (f.kind === "AI_OBSERVATION" ? AI_FACTOR : 1), 0);
  const band: RiskBand = score >= WEIGHTS.HIGH ? "concern" : score >= WEIGHTS.MEDIUM ? "review" : "clear";
  return { score, band, version: SCORING_VERSION };
}
