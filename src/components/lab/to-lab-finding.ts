import type { LabFinding } from "./fixtures";

/** A finding as stored (forensics.service); cross-organisation matches carry only a matchRef. */
export type ApiFinding = { id: string; evidenceFileId?: string | null; kind: string; severity: LabFinding["severity"]; reason: string; ruleVersion: string; evidence: Record<string, unknown> };

const SUBJECT = { BEFORE: "Before photo", AFTER: "After photo", SUPPLEMENT: "Supplementary photo" } as const;

const num = (v: unknown) => (typeof v === "number" ? v : undefined);

/** The stored finding in the shape FindingCard draws. `files` lets a finding about one file say which photo it means. */
export const toLabFinding = (f: ApiFinding, files: { id: string; role: keyof typeof SUBJECT }[] = []): LabFinding => ({
  id: f.id,
  kind: f.kind,
  subject: files.filter((file) => file.id === f.evidenceFileId).map((file) => SUBJECT[file.role])[0],
  severity: f.severity,
  humanReason: f.reason,
  evidence: {
    ruleVersion: f.ruleVersion,
    threshold: num(f.evidence.threshold) ?? 0,
    hammingDistance: num(f.evidence.distance),
    distanceMeters: num(f.evidence.distanceMeters),
    toleranceMeters: num(f.evidence.toleranceMeters),
    matchRef: typeof f.evidence.matchRef === "string" ? f.evidence.matchRef : undefined,
  },
});

export const SEVERITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 } as const;
