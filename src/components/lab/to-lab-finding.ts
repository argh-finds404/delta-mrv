import type { LabFinding, NdviScene } from "./fixtures";

/** A finding as stored (forensics.service); cross-organisation matches carry only a matchRef. */
export type ApiFinding = {
  id: string;
  evidenceFileId?: string | null;
  kind: string;
  severity: LabFinding["severity"];
  reason: string;
  ruleVersion: string;
  evidence: Record<string, unknown>;
  /** A Date on the server, a string once it has crossed JSON. */
  resolution?: { outcome: "CONFIRMED" | "CLEARED"; reason: string; at: Date | string };
};

const SUBJECT = { BEFORE: "Before photo", AFTER: "After photo", SUPPLEMENT: "Supplementary photo" } as const;

const num = (v: unknown) => (typeof v === "number" ? v : undefined);

/** The stored finding in the shape FindingCard draws. `files` lets a finding about one file say which photo it means. */
export const toLabFinding = (f: ApiFinding, files: { id: string; role: keyof typeof SUBJECT }[] = []): LabFinding => ({
  id: f.id,
  kind: f.kind,
  subject: files.filter((file) => file.id === f.evidenceFileId).map((file) => SUBJECT[file.role])[0],
  severity: f.severity,
  humanReason: f.reason,
  ...(f.resolution ? { resolution: { ...f.resolution, at: new Date(f.resolution.at).toISOString() } } : {}),
  evidence: {
    ruleVersion: f.ruleVersion,
    threshold: num(f.evidence.threshold) ?? 0,
    hammingDistance: num(f.evidence.distance),
    distanceMeters: num(f.evidence.distanceMeters),
    toleranceMeters: num(f.evidence.toleranceMeters),
    matchRef: typeof f.evidence.matchRef === "string" ? f.evidence.matchRef : undefined,
    ...(f.kind === "SATELLITE_NDVI"
      ? {
          ndvi: {
            outcome: f.evidence.outcome === "measured" ? ("measured" as const) : ("inconclusive" as const),
            baseline: f.evidence.baseline as NdviScene | undefined,
            current: f.evidence.current as NdviScene | undefined,
            delta: num(f.evidence.delta),
            reason: typeof f.evidence.reason === "string" ? f.evidence.reason : undefined,
            seasonal: f.evidence.seasonal as NonNullable<LabFinding["evidence"]["ndvi"]>["seasonal"],
          },
          telemetry: f.evidence.telemetry,
        }
      : {}),
    ...(f.kind.startsWith("CLAIM_")
      ? {
          claim: {
            boundaryAreaM2: num(f.evidence.boundaryAreaM2),
            perHectare: num(f.evidence.perHectare),
            perSquareMetre: num(f.evidence.perSquareMetre),
            maxPerSquareMetre: num(f.evidence.maxPerSquareMetre),
            ratio: num(f.evidence.ratio),
            tolerance: num(f.evidence.tolerance),
            claimed: num(f.evidence.claimed),
            plants: num(f.evidence.plants),
            unit: typeof f.evidence.unit === "string" ? f.evidence.unit : undefined,
          },
        }
      : {}),
  },
});

export const SEVERITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 } as const;
