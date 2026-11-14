import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/src/components/site/SiteFooter";
import { REPO_URL, SiteHeader } from "@/src/components/site/SiteHeader";
import { EVAL } from "@/src/lib/forensics/eval-results";
import { FUZZ_CELLS_PER_DEGREE } from "@/src/lib/geo/fuzz";
import { CHAIN_NOTE, DOES_NOT_PROVE, PROVES } from "@/src/lib/limits";

export const metadata: Metadata = {
  title: "Trust · Delta",
  description: "What Delta proves and does not, every automated check and its severity, measured detection results, and how site locations are protected.",
};

const container = "mx-auto max-w-[920px] px-6 lg:px-10";
const link = "underline decoration-paper-rule underline-offset-[5px] transition-colors hover:decoration-paper-ink";

// docs/10-FORENSICS.md §3: the condition column is the spec's own wording.
const FINDINGS: [kind: string, severity: "INFO" | "LOW" | "MEDIUM" | "HIGH", condition: string][] = [
  ["EXACT_DUPLICATE_SAME_PROJECT", "LOW", "Identical SHA-256 within the same project"],
  ["EXACT_DUPLICATE_SAME_ORG", "HIGH", "Identical SHA-256, same organisation, different project"],
  ["EXACT_DUPLICATE_OTHER_ORG", "HIGH", "Identical SHA-256, different organisation"],
  ["PERCEPTUAL_MATCH_SAME_PROJECT", "LOW", "Hamming distance < 8 within the same project"],
  ["PERCEPTUAL_MATCH_SAME_ORG", "HIGH", "Hamming distance < 8, same organisation, different project"],
  ["PERCEPTUAL_MATCH_OTHER_ORG", "HIGH", "Hamming distance < 8, different organisation"],
  ["GPS_INSIDE_BOUNDARY", "INFO", "Position in the photo is inside the project boundary"],
  ["GPS_WITHIN_TOLERANCE", "INFO", "Outside, but within the project's tolerance"],
  ["GPS_OUTSIDE_BOUNDARY", "MEDIUM", "Beyond the tolerance; the distance is recorded"],
  ["GPS_MISSING", "LOW", "No position in the photo"],
  ["EXIF_TIMESTAMP_MISSING", "LOW", "No capture time in the photo"],
  ["EXIF_TIMESTAMP_IMPLAUSIBLE", "MEDIUM", "Capture time after the upload, or (for a photo of the work) before the project existed"],
  ["EXIF_FULLY_STRIPPED", "LOW", "No EXIF metadata at all"],
  ["NO_VISIBLE_CHANGE", "MEDIUM", "Before and after are within Hamming distance 4: the pair may show the same scene"],
  ["CLIENT_HASH_MISMATCH", "MEDIUM", "The fingerprint the device computed differs from the stored file's"],
  ["SATELLITE_NDVI", "INFO", "Sentinel-2 vegetation index over the site around each photo's date, or inconclusive and why; advisory, weighs nothing"],
];

const STATUS: [part: string, built: boolean][] = [
  ["Private upload, server-side fingerprint of the stored file", true],
  ["Automatic checks: reuse, near-duplicates, capture time, position, before/after change", true],
  ["Independent review: two reviewers from an organisation independent of the claimant", true],
  ["Append-only review decisions, enforced by the database", true],
  ["Public proof pages and photo lookup", true],
  ["Hash-chained audit log", true],
  ["Batch anchoring on Base Sepolia, checked in the visitor's browser", true],
  ["Satellite vegetation cross-check (advisory, off unless the server enables it)", true],
  ["Device signature over the photos' fingerprints (a browser-held key, optional)", true],
];

const sev = { INFO: "text-paper-muted", LOW: "text-paper-ink", MEDIUM: "text-review", HIGH: "text-fraud" } as const;

export default function TrustPage() {
  const cellKm = Math.round((111.32 / FUZZ_CELLS_PER_DEGREE) * 10) / 10;
  return (
    <div data-theme="paper" className="min-h-dvh bg-paper font-sans text-paper-ink">
      <SiteHeader />
      <main className={`${container} space-y-20 py-12 lg:py-16`}>
        <header className="space-y-5">
          <h1 className="type-display">What Delta proves, and what it does not</h1>
          <p className="max-w-[60ch] text-[17px] leading-[1.6] text-paper-muted">
            A verification tool that overstates itself is worse than none. This page says what the checks are, how well they work when measured, and where they stop.
          </p>
        </header>

        <section aria-labelledby="limits" className="space-y-6">
          <h2 id="limits" className="sr-only">
            Proves and does not prove
          </h2>
          <div className="grid gap-10 md:grid-cols-2">
            {[
              ["It proves", PROVES],
              ["It does not prove", DOES_NOT_PROVE],
            ].map(([title, items]) => (
              <div key={title as string} className="space-y-4">
                <h3 className="type-section">{title as string}</h3>
                <ul className="divide-y divide-paper-rule border-y border-paper-rule">
                  {(items as readonly string[]).map((t) => (
                    <li key={t} className="py-3 text-[16px] leading-[1.5]">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-[15px] text-paper-muted">{CHAIN_NOTE}</p>
        </section>

        <section aria-labelledby="built" className="space-y-5">
          <h2 id="built" className="type-section">
            What is built today
          </h2>
          <ul className="divide-y divide-paper-rule border-y border-paper-rule">
            {STATUS.map(([part, built]) => (
              <li key={part} className="flex items-baseline justify-between gap-6 py-3 text-[16px]">
                <span>{part}</span>
                <span className={`shrink-0 text-[14px] ${built ? "text-paper-seal" : "text-paper-muted"}`}>{built ? "Built" : "Not built yet"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="checks" className="space-y-5">
          <h2 id="checks" className="type-section">
            Every automated check
          </h2>
          <p className="max-w-[62ch] text-[16px] leading-[1.6] text-paper-muted">
            Each check writes a finding with a reason a person can read. Severity is looked up from this table, never computed and never set by AI. A finding is a signal for the reviewers: it approves nothing and blocks nothing. The same photo in one project is a time series (LOW); the same photo behind two claims is the fraud this exists to catch (HIGH).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-y border-paper-rule text-left text-[15px]">
              <thead className="text-[14px] text-paper-muted">
                <tr className="border-b border-paper-rule">
                  <th scope="col" className="py-3 pr-4 font-normal">
                    Finding
                  </th>
                  <th scope="col" className="py-3 pr-4 font-normal">
                    Severity
                  </th>
                  <th scope="col" className="py-3 font-normal">
                    When
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-rule">
                {FINDINGS.map(([kind, severity, condition]) => (
                  <tr key={kind}>
                    <td className="py-3 pr-4 font-mono text-[13px]">{kind}</td>
                    <td className={`py-3 pr-4 font-medium ${sev[severity]}`}>{severity}</td>
                    <td className="py-3 leading-[1.5]">{condition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[15px] text-paper-muted">
            A match in another organisation says that a match exists and how close it is, never which organisation, project or file. Missing metadata is a signal, not guilt.
          </p>
        </section>

        <section aria-labelledby="measured" className="space-y-5">
          <h2 id="measured" className="type-section">
            How well the photo matching works, measured
          </h2>
          <p className="max-w-[62ch] text-[16px] leading-[1.6] text-paper-muted">
            Edited copies of real photographs, run through the real fingerprint at the real threshold (Hamming distance under {EVAL.threshold} of 64). {EVAL.sample} Measured {EVAL.measuredOn}; the test suite re-measures it on every run and fails if these numbers change. Three photographs is a small sample: read it as a description, not a guarantee.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-y border-paper-rule text-left text-[15px]">
              <thead className="text-[14px] text-paper-muted">
                <tr className="border-b border-paper-rule">
                  <th scope="col" className="py-3 pr-4 font-normal">
                    Edit
                  </th>
                  <th scope="col" className="py-3 pr-4 font-normal">
                    Matched
                  </th>
                  <th scope="col" className="py-3 font-normal">
                    Note
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-rule">
                {EVAL.classes.map((c) => (
                  <tr key={c.key}>
                    <td className="py-3 pr-4">{c.label}</td>
                    <td className="py-3 pr-4 tabular-nums">
                      {c.matched} of {c.of}
                    </td>
                    <td className="py-3 leading-[1.5] text-paper-muted">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="max-w-[62ch] text-[15px] leading-[1.6]">
            In short: a re-saved or shrunk copy is usually caught; a cropped or rotated copy is not. Every match found in this sample was a true one, and no two different photographs matched.
          </p>
        </section>

        <section aria-labelledby="location" className="space-y-5">
          <h2 id="location" className="type-section">
            Why exact sites are not published
          </h2>
          <div className="max-w-[62ch] space-y-4 text-[16px] leading-[1.6]">
            <p>
              A restoration site can be a nursery worth stealing from or a habitat worth poaching in. So public maps show the centre of a grid cell about {cellKm} km across, never the site, and the server decides which a caller receives.
            </p>
            <p>
              Each project also publishes a commitment to its exact boundary: <code className="font-mono text-[14px]">SHA-256(&quot;DELTA_LOC_V1:&quot; + salt + &quot;:&quot; + canonical boundary)</code>. Anyone later shown the boundary and its salt can recompute it and confirm the boundary was not changed after the fact.
            </p>
          </div>
        </section>

        <section aria-labelledby="sources" className="space-y-4 border-t border-paper-rule pt-10">
          <h2 id="sources" className="type-section">
            Read the sources
          </h2>
          <ul className="space-y-2 text-[16px]">
            <li>
              <a className={link} href={`${REPO_URL}/blob/main/docs/THREAT_MODEL.md`}>
                Threat model
              </a>
              <span className="text-paper-muted">: the adversaries and what stops each one</span>
            </li>
            <li>
              <a className={link} href={`${REPO_URL}/tree/main/docs/adr`}>
                Architecture decisions
              </a>
              <span className="text-paper-muted">: the anchor registry, the chain, the Merkle and manifest layout</span>
            </li>
            <li>
              <Link className={link} href="/verify">
                Check a photo
              </Link>
              <span className="text-paper-muted">: look up a file among approved records</span>
            </li>
          </ul>
          <p className="pt-2 text-[15px] text-paper-muted">
            Not built: a signature from a hardware security chip, and reading C2PA provenance. The device signature above comes from a key held by the browser.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
