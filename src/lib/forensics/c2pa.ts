// c2pa.v1 (docs/10-FORENSICS.md, X9): pure, isomorphic interpretation of a C2PA Content Credentials
// manifest store JSON (produced by @contentauth/c2pa-wasm in src/server/forensics/c2pa.ts). Most
// phones and cameras do not embed C2PA manifests yet, so a missing manifest is an ordinary INFO
// finding that weighs 0 and never counts against a photo.

export const C2PA_RULE_VERSION = "c2pa.v1";

export type C2paReadResult =
  | { outcome: "absent" }
  | {
      outcome: "valid" | "invalid";
      activeManifest: string;
      signer: string | null;
      issuer: string | null;
      signedAt: string | null;
      alg: string | null;
      claimGenerator: string | null;
      title: string | null;
      actions: string[];
      failureCodes: string[];
      failureReasons: string[];
    };

export type C2paFinding = {
  kind: "CONTENT_CREDENTIALS";
  severity: "INFO";
  reason: string;
  evidence: Record<string, unknown>;
};

type RawValidationEntry = { code?: string; explanation?: string };
type RawManifest = {
  claim_generator?: string;
  claim_generator_info?: { name?: string; version?: string }[];
  title?: string;
  assertions?: { label?: string; data?: { actions?: { action?: string }[] } }[];
  signature_info?: {
    alg?: string;
    issuer?: string;
    common_name?: string;
    time?: string;
  };
};
type RawManifestStore = {
  active_manifest?: string;
  manifests?: Record<string, RawManifest>;
  validation_state?: string;
  validation_status?: RawValidationEntry[];
  validation_results?: {
    activeManifest?: {
      success?: RawValidationEntry[];
      informational?: RawValidationEntry[];
      failure?: RawValidationEntry[];
    };
  };
};

// Camera and tool certificates outside the default C2PA trust anchor list report
// signingCredential.untrusted while their cryptographic signature and data hash verify
// (validation_state === "Valid"). Any signature or hash mismatch flips validation_state to "Invalid".
const SOFT_STATUS_CODES = new Set(["signingCredential.untrusted", "signingCredential.ocsp.skipped"]);

function formatClaimGenerator(m: RawManifest | undefined): string | null {
  if (!m) return null;
  if (typeof m.claim_generator === "string" && m.claim_generator.trim()) return m.claim_generator.trim();
  if (Array.isArray(m.claim_generator_info) && m.claim_generator_info.length > 0) {
    const parts = m.claim_generator_info
      .map((g) => (g.name ? (g.version ? `${g.name}/${g.version}` : g.name) : ""))
      .filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
  }
  return null;
}

function extractActions(m: RawManifest | undefined): string[] {
  if (!m || !Array.isArray(m.assertions)) return [];
  const seen = new Set<string>();
  for (const a of m.assertions) {
    if ((a.label === "c2pa.actions" || a.label === "c2pa.actions.v2") && Array.isArray(a.data?.actions)) {
      for (const act of a.data.actions) {
        if (typeof act.action === "string" && act.action.trim()) seen.add(act.action.trim());
      }
    }
  }
  return [...seen];
}

export function parseC2paManifestStore(rawJson: string): C2paReadResult {
  const store = JSON.parse(rawJson) as RawManifestStore;
  const activeManifest = store.active_manifest;
  if (!activeManifest) return { outcome: "absent" };

  const manifest = store.manifests?.[activeManifest];
  const sig = manifest?.signature_info;
  const rawFailures = store.validation_results?.activeManifest?.failure ?? store.validation_status ?? [];
  const hardFailures = rawFailures.filter((f) => typeof f.code === "string" && !SOFT_STATUS_CODES.has(f.code));
  const failureCodes = hardFailures.map((f) => f.code!).filter(Boolean);
  const failureReasons = hardFailures.map((f) => f.explanation ?? "").filter(Boolean);
  const valid = store.validation_state === "Valid" && failureCodes.length === 0;

  return {
    outcome: valid ? "valid" : "invalid",
    activeManifest,
    signer: sig?.common_name ?? sig?.issuer ?? null,
    issuer: sig?.issuer ?? null,
    signedAt: sig?.time ?? null,
    alg: sig?.alg ?? null,
    claimGenerator: formatClaimGenerator(manifest),
    title: typeof manifest?.title === "string" ? manifest.title : null,
    actions: extractActions(manifest),
    failureCodes,
    failureReasons,
  };
}

export function c2paFinding(read: C2paReadResult): C2paFinding {
  if (read.outcome === "absent") {
    return {
      kind: "CONTENT_CREDENTIALS",
      severity: "INFO",
      reason: "The photo carries no Content Credentials (C2PA) manifest; most phones and cameras do not sign photos yet.",
      evidence: { c2pa: { outcome: "absent" }, ruleVersion: C2PA_RULE_VERSION },
    };
  }
  if (read.outcome === "valid") {
    const who = read.signer ?? read.issuer ?? read.claimGenerator ?? "an unnamed signer";
    return {
      kind: "CONTENT_CREDENTIALS",
      severity: "INFO",
      reason: `Signed Content Credentials from ${who}; the C2PA claim signature and image data hash verified.`,
      evidence: {
        c2pa: {
          outcome: "valid",
          activeManifest: read.activeManifest,
          signer: read.signer,
          issuer: read.issuer,
          signedAt: read.signedAt,
          alg: read.alg,
          claimGenerator: read.claimGenerator,
          title: read.title,
          actions: read.actions,
        },
        ruleVersion: C2PA_RULE_VERSION,
      },
    };
  }
  const detail = read.failureCodes.length ? ` (${read.failureCodes.join(", ")})` : "";
  return {
    kind: "CONTENT_CREDENTIALS",
    severity: "INFO",
    reason: `The photo carries a Content Credentials (C2PA) manifest, but its signature or image data hash did not verify${detail}.`,
    evidence: {
      c2pa: {
        outcome: "invalid",
        activeManifest: read.activeManifest,
        signer: read.signer,
        issuer: read.issuer,
        signedAt: read.signedAt,
        alg: read.alg,
        claimGenerator: read.claimGenerator,
        title: read.title,
        actions: read.actions,
        failureCodes: read.failureCodes,
        failureReasons: read.failureReasons,
      },
      ruleVersion: C2PA_RULE_VERSION,
    },
  };
}
