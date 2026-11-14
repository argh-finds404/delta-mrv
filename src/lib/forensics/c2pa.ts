// c2pa.v1 (docs/10-FORENSICS.md, X9): pure, isomorphic interpretation of what the C2PA reader
// (@contentauth/c2pa-wasm, src/server/forensics/c2pa.ts) reports about a photo's Content
// Credentials. Most phones and cameras do not embed a manifest yet, so a missing one is an ordinary
// INFO finding that weighs nothing. Every outcome is a function of the photo's bytes alone (and the
// reader's version): no network, no clock, so a replay gives the same answer.

export const C2PA_RULE_VERSION = "c2pa.v1";

type Signed = {
  outcome: "valid" | "invalid";
  activeManifest: string;
  signer: string | null;
  issuer: string | null;
  signedAt: string | null;
  alg: string | null;
  claimGenerator: string | null;
  title: string | null;
  actions: string[];
  /** The signing certificate chains to an anchor on the reader's C2PA trust list. */
  trusted: boolean;
  /** The signature carries a validated timestamp, so the certificate was judged at signing time. */
  trustedTime: boolean;
  failureCodes: string[];
  failureReasons: string[];
};

/** What a photo's bytes say. */
export type C2paRead =
  | { outcome: "absent" }
  /** The photo names a manifest stored elsewhere. It is never fetched: any address could be named. */
  | { outcome: "remote"; host: string | null }
  /** C2PA data is there but the reader could not parse it; `code` is the reader's error kind. */
  | { outcome: "unreadable"; code: string }
  | Signed;

/** A read, or the reader could not run on this server at all (no finding is written then). */
export type C2paReadResult = C2paRead | { outcome: "unavailable" };

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
  signature_info?: { alg?: string; issuer?: string; common_name?: string; time?: string };
};
type RawManifestStore = {
  active_manifest?: string;
  manifests?: Record<string, RawManifest>;
  validation_state?: string;
  validation_status?: RawValidationEntry[];
  validation_results?: { activeManifest?: { success?: RawValidationEntry[]; informational?: RawValidationEntry[]; failure?: RawValidationEntry[] } };
};

// Never a failure: a certificate outside the reader's trust list (most cameras and tools today), and
// an OCSP check that was not made because the reader is kept off the network.
const SOFT_STATUS_CODES = new Set(["signingCredential.untrusted", "signingCredential.ocsp.skipped"]);
// Judged against the clock at the moment of reading when the signature has no trusted timestamp:
// they would flip once a certificate expires, so without a trusted time they are not a verdict.
const CLOCK_STATUS_CODES = new Set(["signingCredential.expired", "signingCredential.notYetValid", "claimSignature.outsideValidity"]);

function formatClaimGenerator(m: RawManifest | undefined): string | null {
  if (!m) return null;
  if (typeof m.claim_generator === "string" && m.claim_generator.trim()) return m.claim_generator.trim();
  const parts = (m.claim_generator_info ?? []).map((g) => (g.name ? (g.version ? `${g.name}/${g.version}` : g.name) : "")).filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

function extractActions(m: RawManifest | undefined): string[] {
  const seen = new Set<string>();
  for (const a of m?.assertions ?? []) {
    if ((a.label === "c2pa.actions" || a.label === "c2pa.actions.v2") && Array.isArray(a.data?.actions)) {
      for (const act of a.data.actions) if (typeof act.action === "string" && act.action.trim()) seen.add(act.action.trim());
    }
  }
  return [...seen];
}

/** What the reader's error says about the photo. Its messages read `C2pa(Kind)` or `C2pa(Kind("detail"))`. */
export function classifyReaderError(message: string): C2paRead {
  const kind = /^C2pa\((\w+)/.exec(message)?.[1];
  if (kind === "JumbfNotFound" || kind === "UnsupportedType") return { outcome: "absent" };
  if (kind === "RemoteManifestUrl" || kind === "RemoteManifestFetch") {
    const url = /"(https?:\/\/[^"]+)"/.exec(message)?.[1];
    let host: string | null = null;
    try {
      host = url ? new URL(url).host : null;
    } catch {
      host = null;
    }
    return { outcome: "remote", host };
  }
  return { outcome: "unreadable", code: kind ?? "ReaderError" };
}

/** The verdict on a manifest store, from the reader's validation results. */
export function parseC2paManifestStore(rawJson: string): C2paRead {
  let store: RawManifestStore;
  try {
    store = JSON.parse(rawJson) as RawManifestStore;
  } catch {
    return { outcome: "unreadable", code: "ManifestJson" };
  }
  const activeManifest = store.active_manifest;
  if (!activeManifest) return { outcome: "absent" };

  const manifest = store.manifests?.[activeManifest];
  const sig = manifest?.signature_info;
  const results = store.validation_results?.activeManifest;
  const trustedTime = (results?.success ?? []).some((s) => s.code === "timeStamp.validated");
  const rawFailures = results?.failure ?? store.validation_status ?? [];
  const hardFailures = rawFailures.filter((f) => typeof f.code === "string" && !SOFT_STATUS_CODES.has(f.code) && (trustedTime || !CLOCK_STATUS_CODES.has(f.code)));
  const failureCodes = hardFailures.map((f) => f.code!);

  return {
    // the reader's own state also counts soft and clock-relative codes, so the verdict is the hard failures
    outcome: failureCodes.length === 0 ? "valid" : "invalid",
    activeManifest,
    signer: sig?.common_name ?? sig?.issuer ?? null,
    issuer: sig?.issuer ?? null,
    signedAt: sig?.time ?? null,
    alg: sig?.alg ?? null,
    claimGenerator: formatClaimGenerator(manifest),
    title: typeof manifest?.title === "string" ? manifest.title : null,
    actions: extractActions(manifest),
    trusted: store.validation_state === "Trusted",
    trustedTime,
    failureCodes,
    failureReasons: hardFailures.map((f) => f.explanation ?? "").filter(Boolean),
  };
}

const finding = (reason: string, c2pa: Record<string, unknown>): C2paFinding => ({ kind: "CONTENT_CREDENTIALS", severity: "INFO", reason, evidence: { c2pa, ruleVersion: C2PA_RULE_VERSION } });

/** The one finding a read produces. A reader that could not run produces none (the caller skips it). */
export function c2paFinding(read: C2paRead): C2paFinding {
  switch (read.outcome) {
    case "absent":
      return finding("The photo carries no Content Credentials (C2PA) manifest; most phones and cameras do not sign photos yet.", { outcome: "absent" });
    case "remote":
      return finding(
        `The photo points to Content Credentials stored at ${read.host ?? "an address it does not name clearly"}. Delta never fetches a remote manifest, so they were not checked.`,
        { outcome: "remote", host: read.host },
      );
    case "unreadable":
      return finding(`The photo carries Content Credentials (C2PA) data that could not be read (${read.code}).`, { outcome: "unreadable", code: read.code });
  }
  const signed = {
    activeManifest: read.activeManifest,
    signer: read.signer,
    issuer: read.issuer,
    signedAt: read.signedAt,
    alg: read.alg,
    claimGenerator: read.claimGenerator,
    title: read.title,
    actions: read.actions,
    trusted: read.trusted,
    trustedTime: read.trustedTime,
  };
  if (read.outcome === "valid") {
    const who = read.signer ?? read.issuer ?? read.claimGenerator ?? "an unnamed signer";
    const trust = read.trusted ? ", a certificate on the C2PA trust list" : "";
    const time = read.trustedTime ? "" : " The signature carries no trusted timestamp, so when it was made is the signer's word.";
    return finding(`Signed Content Credentials from ${who}${trust}; the C2PA claim signature and image data hash verified.${time}`, { outcome: "valid", ...signed });
  }
  const detail = read.failureCodes.length ? ` (${read.failureCodes.join(", ")})` : "";
  return finding(`The photo carries a Content Credentials (C2PA) manifest, but its signature or image data hash did not verify${detail}.`, {
    outcome: "invalid",
    ...signed,
    failureCodes: read.failureCodes,
    failureReasons: read.failureReasons,
  });
}
