import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Compass,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Wordmark } from "@/src/components/site/Wordmark";

export const metadata: Metadata = {
  title: "Trust, Forensics & System Limits · Delta",
  description:
    "System specification, measured precision/recall, forensic rules, and cryptographic boundaries of Delta MRV.",
};

const FORENSIC_RULES = [
  {
    kind: "EXACT_DUPLICATE_SAME_PROJECT",
    severity: "LOW",
    domain: "Duplicates",
    rule: "Byte-identical SHA-256 match within the same project. Expected in recurring plot time-series.",
  },
  {
    kind: "EXACT_DUPLICATE_SAME_ORG",
    severity: "HIGH",
    domain: "Duplicates",
    rule: "Byte-identical SHA-256 match across different projects owned by the same organisation. Flags grant double-claiming.",
  },
  {
    kind: "EXACT_DUPLICATE_OTHER_ORG",
    severity: "HIGH",
    domain: "Duplicates",
    rule: "Byte-identical SHA-256 match across projects owned by different organisations. Re-use of public imagery.",
  },
  {
    kind: "PERCEPTUAL_MATCH_SAME_PROJECT",
    severity: "LOW",
    domain: "Perceptual",
    rule: "64-bit dHash Hamming distance < 8 within same project. Indicates repeated vantage angle.",
  },
  {
    kind: "PERCEPTUAL_MATCH_SAME_ORG",
    severity: "HIGH",
    domain: "Perceptual",
    rule: "64-bit dHash Hamming distance < 8 across different projects by same org. Recycled baseline photos.",
  },
  {
    kind: "PERCEPTUAL_MATCH_OTHER_ORG",
    severity: "HIGH",
    domain: "Perceptual",
    rule: "64-bit dHash Hamming distance < 8 across different organisations. Cross-entity photo plagiarism.",
  },
  {
    kind: "NO_VISIBLE_CHANGE",
    severity: "MEDIUM",
    domain: "Pair Delta",
    rule: "BEFORE vs AFTER dHash distance < 4 bits. Indicates no perceptible site alteration or vegetative growth.",
  },
  {
    kind: "GPS_OUTSIDE_BOUNDARY",
    severity: "MEDIUM",
    domain: "Geofence",
    rule: "Photo EXIF coordinates located beyond project boundary and tolerance buffer. Off-site nursery spoofing.",
  },
  {
    kind: "EXIF_TIMESTAMP_IMPLAUSIBLE",
    severity: "MEDIUM",
    domain: "EXIF",
    rule: "Capture timestamp post-dates file upload or pre-dates registered project inception date.",
  },
  {
    kind: "EXIF_FULLY_STRIPPED",
    severity: "LOW",
    domain: "EXIF",
    rule: "No EXIF/TIFF segments present. Common when photos are forwarded via WhatsApp/Telegram.",
  },
  {
    kind: "GPS_MISSING",
    severity: "LOW",
    domain: "Geofence",
    rule: "Image carries camera telemetry but lacks embedded GPS tags. Missing signal, not proof of fraud.",
  },
  {
    kind: "GPS_INSIDE_BOUNDARY",
    severity: "INFO",
    domain: "Geofence",
    rule: "PostGIS ST_Covers evaluates true. Photograph verified within registered restoration boundary.",
  },
];

export default function TrustPage() {
  return (
    <div
      data-theme="paper"
      className="min-h-screen bg-paper text-paper-ink font-sans transition-colors pb-16"
    >
      {/* Paper Top Navigation */}
      <nav className="border-b border-paper-rule bg-paper-card px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/atlas" className="flex items-center gap-2 group">
            <Wordmark className="text-paper-ink" />
            <span className="text-paper-muted text-xs">/</span>
            <span className="text-xs text-paper-muted">Trust &amp; Verification Protocol</span>
          </Link>

          <div className="flex items-center gap-4 text-xs font-mono">
            <Link
              href="/verify"
              className="text-paper-muted hover:text-paper-ink transition-colors"
            >
              Reverse Lookup
            </Link>
            <Link
              href="/atlas"
              className="text-paper-muted hover:text-paper-ink transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="size-3" />
              <span>Atlas</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Single-Column Paper Measure */}
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
        {/* 1. Header */}
        <header className="space-y-4 border-b border-paper-rule pb-8">
          <span className="rounded-md border border-paper-rule bg-paper-card px-2.5 py-1 text-xs font-mono text-paper-muted uppercase tracking-wider">
            Amendment A8 · Authority Specification
          </span>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-paper-ink sm:text-4xl">
            Trust Architecture &amp; System Limits
          </h1>
          <p className="text-sm text-paper-muted leading-relaxed max-w-2xl">
            A verification system that implies absence is guilt or exaggerates digital proof is worse
            than no system at all. This document discloses Delta&apos;s cryptographic bounds, forensic
            rules, and measured precision.
          </p>
        </header>

        {/* 2. What Delta Proves vs What Delta Does NOT Prove */}
        <section aria-labelledby="limits-heading" className="space-y-4">
          <h2 id="limits-heading" className="font-serif text-2xl font-medium text-paper-ink">
            What Delta Proves and Does Not Prove
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            {/* Proves */}
            <div className="rounded-xl border border-paper-seal/40 bg-paper-seal/5 p-6 space-y-3">
              <div className="flex items-center gap-2 text-paper-seal font-medium text-sm">
                <ShieldCheck className="size-5 shrink-0" />
                <span>What Delta Proves</span>
              </div>
              <ul className="text-xs text-paper-muted leading-relaxed space-y-2 list-disc pl-4">
                <li>
                  <strong className="text-paper-ink">Cryptographic Existence:</strong> Specific
                  photographic files existed at specific timestamps without subsequent modification.
                </li>
                <li>
                  <strong className="text-paper-ink">Conflict-of-Interest Consensus:</strong> Two
                  independent reviewer organisations audited the claim with mandatory written
                  reasons.
                </li>
                <li>
                  <strong className="text-paper-ink">Append-Only Immutability:</strong> The audit trail
                  and Merkle proofs anchored to Base Sepolia cannot be altered, rolled back, or deleted.
                </li>
                <li>
                  <strong className="text-paper-ink">Duplicate &amp; Geofence Consistency:</strong>{" "}
                  Perceptual dHash and PostGIS polygon tests verify on-site geographic consistency.
                </li>
              </ul>
            </div>

            {/* Does NOT Prove */}
            <div className="rounded-xl border border-[#E8A33D]/40 bg-[#E8A33D]/5 p-6 space-y-3">
              <div className="flex items-center gap-2 text-[#9A6014] font-medium text-sm">
                <ShieldAlert className="size-5 shrink-0" />
                <span>What Delta Does NOT Prove</span>
              </div>
              <ul className="text-xs text-paper-muted leading-relaxed space-y-2 list-disc pl-4">
                <li>
                  <strong className="text-paper-ink">Biological Longevity:</strong> Delta does not
                  prove that trees grew, that carbon was permanently sequestered, or that saplings
                  survive beyond the capture date.
                </li>
                <li>
                  <strong className="text-paper-ink">Soil / Ecology Quality:</strong> Digital records
                  do not replace on-the-ground soil assays, biomass core sampling, or botanical
                  surveys.
                </li>
                <li>
                  <strong className="text-paper-ink">Actor Identity:</strong> Delta does not verify
                  the physical identity of field photographers beyond their organization membership.
                </li>
                <li>
                  <strong className="text-paper-ink">Ground Reality:</strong> Physical reality can
                  diverge from digital records. Independent physical auditing remains essential.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 3. Forensics Pipeline Rules Table */}
        <section aria-labelledby="rules-heading" className="space-y-4">
          <div className="flex items-center justify-between border-t border-paper-rule pt-8">
            <h2 id="rules-heading" className="font-serif text-2xl font-medium text-paper-ink">
              Forensic Radar Detection Rules
            </h2>
            <span className="font-mono text-xs text-paper-muted">Deterministic Pipeline</span>
          </div>
          <p className="text-xs text-paper-muted leading-relaxed">
            Delta evaluates 12 deterministic signals on intake. Severity is looked up from rules, never
            invented. Signals inform independent human auditors in the Evidence Lab; AI never approves
            or rejects grants autonomously.
          </p>

          <div className="overflow-x-auto rounded-xl border border-paper-rule bg-paper-card">
            <table className="w-full text-left text-xs font-sans">
              <thead className="border-b border-paper-rule bg-paper text-[11px] font-mono uppercase text-paper-muted">
                <tr>
                  <th className="p-3">Signal Code</th>
                  <th className="p-3">Domain</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Audit Operational Rule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-rule/60 text-xs">
                {FORENSIC_RULES.map((r) => (
                  <tr key={r.kind} className="hover:bg-paper/40 transition-colors">
                    <td className="p-3 font-mono text-[11px] font-semibold text-paper-ink">
                      {r.kind}
                    </td>
                    <td className="p-3 text-paper-muted font-mono text-[11px]">{r.domain}</td>
                    <td className="p-3 font-mono text-[11px]">
                      <span
                        className={
                          r.severity === "HIGH"
                            ? "text-fraud font-semibold"
                            : r.severity === "MEDIUM"
                              ? "text-[#9A6014] font-semibold"
                              : r.severity === "LOW"
                                ? "text-paper-muted"
                                : "text-paper-seal"
                        }
                      >
                        {r.severity}
                      </span>
                    </td>
                    <td className="p-3 text-paper-muted leading-relaxed max-w-md">{r.rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Coordinate Fuzzing & Privacy Protection */}
        <section aria-labelledby="privacy-heading" className="space-y-4">
          <div className="flex items-center justify-between border-t border-paper-rule pt-8">
            <h2 id="privacy-heading" className="font-serif text-2xl font-medium text-paper-ink">
              Coordinate Fuzzing &amp; Habitat Protection
            </h2>
            <span className="font-mono text-xs text-paper-muted">RFC 8785 Commitments</span>
          </div>

          <div className="rounded-xl border border-paper-rule bg-[#EDE6D6] p-6 space-y-3 text-xs leading-relaxed text-paper-muted">
            <div className="flex items-center gap-2 text-paper-ink font-semibold">
              <Compass className="size-4 text-paper-seal" />
              <span>Why Delta Withholds Exact Polygon Coordinates on Public Routes</span>
            </div>
            <p>
              Environmental restoration projects often protect endangered flora, rare mangrove
              nurseries, or sensitive coastal tiger habitats. Publishing exact coordinates invites
              poaching, illegal logging, and biopiracy incursions.
            </p>
            <p>
              Delta computes an area-level fuzzed centroid (approx. 5.5 km grid cell centre) for
              public maps and commits to the exact boundary using a cryptographic location commitment:
            </p>
            <div className="rounded bg-paper-card p-3 font-mono text-[11px] text-paper-ink border border-paper-rule">
              locationCommitment = SHA256(&quot;DELTA_LOC_V1:&quot; + salt_hex + &quot;:&quot; +
              canonicalize(exactGeoJson))
            </div>
            <p>
              The salt and exact polygon are disclosed only to authorized independent auditors
              assigned to that project. Any stranger can verify the commitment once authorized.
            </p>
          </div>
        </section>

        {/* 5. Architectural Decision Records (ADRs) */}
        <section aria-labelledby="adrs-heading" className="space-y-4 border-t border-paper-rule pt-8">
          <h2 id="adrs-heading" className="font-serif text-2xl font-medium text-paper-ink">
            Core Architectural Decision Records
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-xs">
            <div className="rounded-xl border border-paper-rule bg-paper-card p-4 space-y-1.5">
              <span className="font-mono text-[11px] text-paper-muted uppercase block">ADR-0001</span>
              <strong className="text-paper-ink font-serif block">Custom Registry vs EAS</strong>
              <p className="text-paper-muted text-[11px] leading-relaxed">
                Foundry-audited minimal registry contract over EAS to eliminate external schema
                dependencies and gas overhead.
              </p>
            </div>
            <div className="rounded-xl border border-paper-rule bg-paper-card p-4 space-y-1.5">
              <span className="font-mono text-[11px] text-paper-muted uppercase block">ADR-0002</span>
              <strong className="text-paper-ink font-serif block">Base Sepolia L2 Anchoring</strong>
              <p className="text-paper-muted text-[11px] leading-relaxed">
                Public EVM anchoring on Base Sepolia with 1-per-day Merkle tree batches, ensuring $0
                operating cost at scale.
              </p>
            </div>
            <div className="rounded-xl border border-paper-rule bg-paper-card p-4 space-y-1.5">
              <span className="font-mono text-[11px] text-paper-muted uppercase block">ADR-0005</span>
              <strong className="text-paper-ink font-serif block">Deterministic Merkle Leaves</strong>
              <p className="text-paper-muted text-[11px] leading-relaxed">
                StandardMerkleTree sorting leaves by submission ID to guarantee cross-runtime
                agreement between Node and browser.
              </p>
            </div>
          </div>
        </section>

        {/* 6. Footer */}
        <footer className="border-t border-paper-rule pt-8 text-xs text-paper-muted text-center space-y-2">
          <p>Delta MRV · Open Ecological Verification Engine</p>
          <div className="flex items-center justify-center gap-4 text-[11px] font-mono">
            <Link href="/verify" className="hover:text-paper-ink hover:underline">
              Reverse Verification
            </Link>
            <span>·</span>
            <Link href="/atlas" className="hover:text-paper-ink hover:underline">
              Impact Atlas
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

