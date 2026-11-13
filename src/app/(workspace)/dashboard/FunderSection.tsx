import Link from "next/link";
import { ApiKeys } from "@/src/components/funder/ApiKeys";
import { StatusBadge } from "@/src/components/status-badge/status-badge";
import { ACTIVITY_LABEL, formatCount } from "@/src/lib/format";
import type { ApiKeyView } from "@/src/server/services/api-key.service";
import type { FunderPortfolio } from "@/src/server/services/funder.service";
import { createApiKeyAction, revokeApiKeyAction } from "./actions";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/**
 * The funder's view of the dashboard (docs/05-ROUTES.md §3): what is approved at the sites it
 * funds, what is anchored, and where to check each record. Every figure is counted from
 * approved and anchored records only; a funder sees nothing else.
 */
export function FunderSection({ portfolio, keys }: { portfolio: FunderPortfolio & { orgId: string; orgName: string }; keys: ApiKeyView[] }) {
  const { totals, projects, latest } = portfolio;
  const anchoredPct = totals.approved ? Math.round((totals.anchored / totals.approved) * 100) : 0;
  const tiles: [label: string, value: string, note: string][] = [
    ["Approved records", formatCount(totals.approved), "each approved by two reviewers of an independent organisation"],
    ["Anchored on chain", `${anchoredPct}%`, `${formatCount(totals.anchored)} of ${formatCount(totals.approved)} approved records are in a confirmed batch`],
    ["Hectares at sites with approved records", formatCount(totals.hectaresWithApprovedRecords), "the area of the funded sites, not a measure of what grew there"],
    ["Independent verifier organisations", formatCount(totals.verifierOrgs), `reviewing ${formatCount(totals.projects)} funded ${totals.projects === 1 ? "project" : "projects"}`],
  ];

  return (
    <>
      <section aria-labelledby="funded" className="rise-in space-y-5">
        <h2 id="funded" className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
          What your funding has on record
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map(([label, value, note]) => (
            <div key={label} className="lift flex flex-col gap-1 rounded-2xl border border-field-hairline bg-field-canopy p-5">
              <dt className="text-[14px] text-field-muted">{label}</dt>
              <dd className="font-serif text-[40px] leading-none tabular-nums" data-testid={`funder-${label.split(" ")[0]!.toLowerCase()}`}>
                {value}
              </dd>
              <dd className="text-[13px] leading-[1.5] text-field-muted">{note}</dd>
            </div>
          ))}
        </dl>
        <p className="max-w-[72ch] text-[14px] leading-[1.6] text-field-muted">
          An approved record means the evidence passed its checks and two independent reviewers agreed. It does not prove that trees were planted or survived.
        </p>
      </section>

      {projects.length > 0 && (
        <section aria-labelledby="funded-projects" className="rise-in space-y-4">
          <h2 id="funded-projects" className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
            Funded projects
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {projects.map((p) => (
              <li key={p.id} className="lift space-y-2 rounded-2xl border border-field-hairline bg-field-canopy p-5">
                <p className="text-[13px] text-field-muted">
                  {ACTIVITY_LABEL[p.activityType] ?? p.activityType} · {p.ownerOrgName}
                </p>
                <Link href={`/p/${p.id}`} className="block font-serif text-[22px] leading-[1.2] underline decoration-field-hairline underline-offset-[5px] hover:decoration-field-text">
                  {p.title}
                </Link>
                <p className="text-[14px] tabular-nums text-field-muted">
                  {formatCount(p.approved)} approved · {formatCount(p.anchored)} anchored · {formatCount(p.hectares)} ha site
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {latest.length > 0 && (
        <section aria-labelledby="funded-latest" className="rise-in space-y-4">
          <h2 id="funded-latest" className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
            Latest approved records
          </h2>
          <ul className="divide-y divide-field-hairline rounded-2xl border border-field-hairline bg-field-canopy">
            {latest.map((l) => (
              <li key={l.submissionId} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3.5">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{l.projectTitle}</p>
                  <p className="text-[13px] text-field-muted">Submitted {l.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[14px]">
                  <StatusBadge status={l.status} />
                  <Link href={`/proof/${l.submissionId}`} className="underline decoration-field-hairline underline-offset-4 hover:decoration-field-text">
                    Proof page
                  </Link>
                  <a href={`/api/v1/submissions/${l.submissionId}/proof`} download={`delta-audit-bundle-${l.submissionId.slice(0, 8)}.json`} className="underline decoration-field-hairline underline-offset-4 hover:decoration-field-text">
                    Audit bundle (.json)
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="funder-api" className="rise-in space-y-4">
        <h2 id="funder-api" className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
          API access
        </h2>
        <ApiKeys
          orgId={portfolio.orgId}
          keys={keys.map((k) => ({ id: k.id, keyPrefix: k.keyPrefix, createdAt: k.createdAt.toISOString(), lastUsedAt: iso(k.lastUsedAt), revokedAt: iso(k.revokedAt) }))}
          create={createApiKeyAction}
          revoke={revokeApiKeyAction}
        />
      </section>
    </>
  );
}
