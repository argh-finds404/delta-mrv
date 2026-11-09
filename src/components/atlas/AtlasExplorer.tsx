"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, X } from "lucide-react";
import { HashDisplay } from "@/src/components/hash-display/hash-display";
import { Wordmark } from "@/src/components/site/Wordmark";
import { formatCount, formatLatLon } from "@/src/lib/format";
import { cn } from "@/src/lib/utils";
import { AtlasMap, type AtlasPadding, type Basemap } from "./AtlasMap";
import type { AtlasSite, AtlasSiteRecord } from "./types";

export interface AtlasExplorerProps {
  sites: AtlasSite[];
  /** Totals across every active site, counted by the server when the page loaded. */
  overview: { sites: number; approved: number; verifierOrgs: number };
  /** True when the server found a session; it never means the client may ask for more. */
  signedIn: boolean;
  /** A site to open on arrival, from ?site= */
  initialSiteId?: string | null;
}

const PANEL = 380;
const DRAWER = 400;
const GAP = 16;

const wideQuery = "(min-width: 900px)";
const subscribeWide = (cb: () => void) => {
  const m = window.matchMedia(wideQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const subscribeResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};

type RecordState = { status: "loading" } | { status: "error" } | ({ status: "ready" } & AtlasSiteRecord);

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

/**
 * The Impact Atlas, pattern 1: the map is the page, and everything else floats over it as a
 * glass island. Pattern 2: the list and the map are one thing; hovering either lights the other.
 */
export function AtlasExplorer({ sites, overview, signedIn, initialSiteId = null }: AtlasExplorerProps) {
  const [activity, setActivity] = React.useState<string | null>(null);
  const [basemap, setBasemap] = React.useState<Basemap>("satellite");
  const [selectedId, setSelectedId] = React.useState<string | null>(() =>
    sites.some((s) => s.id === initialSiteId) ? initialSiteId : null,
  );
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [records, setRecords] = React.useState<Record<string, RecordState>>(() =>
    selectedId ? { [selectedId]: { status: "loading" } } : {},
  );
  const wide = React.useSyncExternalStore(subscribeWide, () => window.matchMedia(wideQuery).matches, () => true);
  const viewportHeight = React.useSyncExternalStore(subscribeResize, () => window.innerHeight, () => 900);

  const activities = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sites) counts.set(s.activity, (counts.get(s.activity) ?? 0) + 1);
    return [...counts].sort(([a], [b]) => a.localeCompare(b));
  }, [sites]);
  const visible = React.useMemo(() => (activity ? sites.filter((s) => s.activity === activity) : sites), [sites, activity]);
  const exactCount = sites.filter((s) => s.area.kind === "exact").length;
  const selected = visible.find((s) => s.id === selectedId) ?? null;

  // Keep the camera's subject out from under the panels. Below 900px the sheets are 45dvh and 75dvh.
  const padding = React.useMemo<AtlasPadding>(
    () =>
      wide
        ? { top: 96, bottom: 64, left: PANEL + GAP * 2 + 48, right: selected ? DRAWER + GAP * 2 + 48 : 72 }
        : { top: 72, left: 32, right: 32, bottom: Math.round(viewportHeight * (selected ? 0.75 : 0.45)) + 32 },
    [wide, selected, viewportHeight],
  );

  // Public, cached, session-blind: the same read the API offers anyone.
  const fetchRecord = React.useCallback((id: string) => {
    fetch(`/api/v1/projects/${id}`)
      .then((res) => (res.ok ? (res.json() as Promise<AtlasSiteRecord>) : Promise.reject(new Error(String(res.status)))))
      .then((d) => setRecords((r) => ({ ...r, [id]: { status: "ready", verifierOrgNames: d.verifierOrgNames, record: d.record } })))
      .catch(() => setRecords((r) => ({ ...r, [id]: { status: "error" } })));
  }, []);
  const loadRecord = React.useCallback(
    (id: string) => {
      setRecords((r) => ({ ...r, [id]: { status: "loading" } }));
      fetchRecord(id);
    },
    [fetchRecord],
  );

  const select = React.useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (id && !records[id]) loadRecord(id);
      // shareable, without adding a history entry per click
      window.history.replaceState(null, "", id ? `?site=${id}` : window.location.pathname);
    },
    [records, loadRecord],
  );

  // A site opened from the URL needs its record too (its loading state is set at init).
  const initial = React.useRef(selectedId);
  React.useEffect(() => {
    if (initial.current) fetchRecord(initial.current);
  }, [fetchRecord]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  return (
    <div
      className="fixed inset-0 h-dvh w-screen overflow-hidden bg-field-stage font-sans text-field-text [--atlas-inset-bottom:45dvh] min-[900px]:[--atlas-inset-bottom:0px] min-[900px]:[--atlas-inset-left:412px]"
      style={{ "--atlas-inset-right": selected && wide ? `${DRAWER + GAP * 2}px` : "0px" } as React.CSSProperties}
    >
      <AtlasMap
        sites={visible}
        selectedId={selected?.id ?? null}
        hoveredId={hoveredId}
        onSelect={select}
        onHover={setHoveredId}
        basemap={basemap}
        padding={padding}
        className="absolute inset-0"
      />

      {/* Top right: what the registry holds today, and the basemap. Real counts, read on load. */}
      {/* steps aside for the drawer instead of showing through its glass */}
      <div
        className="absolute right-4 top-4 z-20 flex flex-col items-end gap-2 motion-safe:transition-transform motion-safe:duration-[220ms] motion-safe:ease-[cubic-bezier(0.2,0,0,1)]"
        style={{ transform: "translateX(calc(var(--atlas-inset-right) * -1))" }}
      >
        <dl className="hud hidden items-stretch divide-x divide-field-hairline sm:flex" aria-label="The registry today">
          {[
            { n: overview.sites, label: overview.sites === 1 ? "active site" : "active sites" },
            { n: overview.approved, label: "approved submissions" },
            { n: overview.verifierOrgs, label: overview.verifierOrgs === 1 ? "independent reviewer" : "independent reviewers" },
          ].map(({ n, label }) => (
            <div key={label} className="flex flex-col-reverse px-4 py-2.5">
              <dt className="text-[12px] text-field-muted">{label}</dt>
              <dd className="font-serif text-[22px] leading-tight tabular-nums">{formatCount(n)}</dd>
            </div>
          ))}
        </dl>
        <div role="group" aria-label="Basemap" className="hud flex p-1">
          {(["satellite", "map"] as const).map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={basemap === b}
              onClick={() => setBasemap(b)}
              className={cn(
                "h-8 rounded-lg px-3 text-[13px] capitalize transition-colors",
                focusRing,
                basemap === b ? "bg-field-raised text-field-text" : "text-field-muted hover:text-field-text",
              )}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* The site panel: Felt's layer list, for sites. A bottom sheet below 900px. */}
      <aside
        aria-label="Sites"
        className="hud absolute inset-x-0 bottom-0 z-20 flex max-h-[45dvh] flex-col rounded-b-none min-[900px]:inset-x-auto min-[900px]:bottom-4 min-[900px]:left-4 min-[900px]:top-4 min-[900px]:max-h-none min-[900px]:w-[380px] min-[900px]:rounded-b-xl"
      >
        <div className="flex items-center justify-between border-b border-field-hairline px-5 py-4">
          <Link href="/" className={cn("rounded-sm", focusRing)}>
            <Wordmark className="text-field-text" />
          </Link>
          {!signedIn && (
            <Link href="/sign-in?next=/atlas" className="text-[13px] text-field-muted underline-offset-4 hover:text-field-text hover:underline">
              Sign in
            </Link>
          )}
        </div>

        <div className="overflow-y-auto">
          <div className="space-y-3 px-5 pt-5">
            <h1 className="font-serif text-[30px] leading-[1.05] tracking-[-0.015em]">Impact atlas</h1>
            <p className="text-[15px] leading-[1.6] text-field-muted">
              Restoration sites being checked by organisations independent of the people doing the work.
            </p>
            <Legend exactCount={exactCount} />
          </div>

          {activities.length > 1 && (
            <div role="group" aria-label="Filter by activity" className="flex flex-wrap gap-2 px-5 pt-5">
              {[[null, sites.length] as const, ...activities].map(([value, n]) => (
                <button
                  key={value ?? "all"}
                  type="button"
                  aria-pressed={activity === value}
                  onClick={() => setActivity(value)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
                    focusRing,
                    activity === value
                      ? "border-signal/60 bg-signal/15 text-signal"
                      : "border-field-hairline text-field-muted hover:border-field-inert hover:text-field-text",
                  )}
                >
                  {value ?? "All"}
                  <span className="font-mono text-[12px] tabular-nums opacity-75">{n}</span>
                </button>
              ))}
            </div>
          )}

          <ul className="py-4">
            {visible.map((s) => {
              const on = s.id === selected?.id;
              const lit = s.id === hoveredId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => select(on ? null : s.id)}
                    onMouseEnter={() => setHoveredId(s.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onFocus={() => setHoveredId(s.id)}
                    onBlur={() => setHoveredId(null)}
                    aria-current={on ? "true" : undefined}
                    className={cn(
                      "group flex w-full items-center gap-3 border-l-2 px-5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal",
                      on ? "border-signal bg-field-raised" : lit ? "border-signal/50 bg-field-raised/60" : "border-transparent hover:bg-field-raised/60",
                    )}
                  >
                    <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full border border-signal transition-colors", on || lit ? "bg-signal" : "bg-transparent")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{s.title}</span>
                      <span className="block truncate text-[13px] text-field-muted">
                        {s.activity} · {s.ownerOrgName}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-field-muted opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="mt-auto border-t border-field-hairline px-5 py-3 text-[12px] text-field-muted">
          Demonstration data, read live from the registry.
        </p>
      </aside>

      {/* The drawer slides with transform only (docs/19-LAYOUT-SPEC.md §6). */}
      <aside
        aria-label="Site details"
        inert={!selected}
        className={cn(
          "hud absolute inset-x-0 bottom-0 z-30 flex max-h-[75dvh] flex-col rounded-b-none",
          "min-[900px]:inset-x-auto min-[900px]:bottom-4 min-[900px]:right-4 min-[900px]:top-4 min-[900px]:max-h-none min-[900px]:w-[400px] min-[900px]:rounded-b-xl",
          "motion-safe:transition-transform motion-safe:duration-[220ms]",
          selected
            ? "translate-y-0 ease-[cubic-bezier(0.2,0,0,1)] min-[900px]:translate-x-0"
            : "translate-y-[calc(100%+16px)] ease-[cubic-bezier(0.4,0,1,1)] min-[900px]:translate-x-[calc(100%+16px)] min-[900px]:translate-y-0",
        )}
      >
        {selected && (
          <SiteDetail key={selected.id} site={selected} state={records[selected.id]} onClose={() => select(null)} onRetry={() => loadRecord(selected.id)} />
        )}
      </aside>
    </div>
  );
}

/** Explains the two outline styles. Shown, because a reader cannot guess what dashed means. */
function Legend({ exactCount }: { exactCount: number }) {
  return (
    <dl className="space-y-2 rounded-lg border border-field-hairline bg-field-stage/40 p-3 text-[13px] leading-normal">
      <div className="flex gap-3">
        <dt className="pt-0.5">
          <svg width="16" height="16" aria-hidden className="text-signal">
            <rect x="1.5" y="1.5" width="13" height="13" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeDasharray="3 2" />
          </svg>
          <span className="sr-only">Dashed area</span>
        </dt>
        <dd className="text-field-muted">
          <span className="text-field-text">Approximate area, about 5.5 km across.</span> The exact boundary is withheld to protect the site.
        </dd>
      </div>
      {exactCount > 0 && (
        <div className="flex gap-3">
          <dt className="pt-0.5">
            <svg width="16" height="16" aria-hidden className="text-signal">
              <rect x="1.5" y="1.5" width="13" height="13" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="sr-only">Solid outline</span>
          </dt>
          <dd className="text-field-muted">
            <span className="text-field-text">Exact boundary.</span> Shown for the {exactCount === 1 ? "site" : `${exactCount} sites`} your organisation owns
            or reviews.
          </dd>
        </div>
      )}
    </dl>
  );
}

function SiteDetail({ site, state, onClose, onRetry }: { site: AtlasSite; state: RecordState | undefined; onClose: () => void; onRetry: () => void }) {
  const rise = (i: number) => ({ "--i": i }) as React.CSSProperties;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="drawer-rise flex items-start justify-between gap-4 px-5 pt-5">
        <div className="min-w-0 space-y-2">
          <p className="text-[13px] text-field-muted">
            {site.activity} · {site.ownerOrgName}
          </p>
          <h2 className="font-serif text-[28px] leading-[1.1] tracking-[-0.01em]">{site.title}</h2>
          <div className="pt-0.5">
            <Link
              href={`/p/${site.id}`}
              className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium text-signal hover:underline", focusRing)}
            >
              <span>Project record</span>
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close site details"
          className={cn("-mr-2 flex size-10 shrink-0 items-center justify-center rounded-lg text-field-muted transition-colors hover:bg-field-raised hover:text-field-text", focusRing)}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 pb-6 pt-6">
        <section aria-labelledby="claim-record" className="drawer-rise space-y-4" style={rise(1)}>
          <h3 id="claim-record" className="text-[15px] font-medium">
            The claim and the record
          </h3>
          <dl className="divide-y divide-field-hairline border-y border-field-hairline text-[15px]">
            <Row term="Claimed">{site.claim ?? <span className="text-field-muted">No quantity claimed</span>}</Row>
            {state?.status === "ready" ? (
              <>
                <Row term="Approved evidence">
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden className="size-1.5 rounded-full bg-verified" />
                    <Count n={state.record.approved} one="submission" many="submissions" />
                  </span>
                </Row>
                <Row term="Anchored">
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden className="size-1.5 rounded-full bg-chain" />
                    <Count n={state.record.anchored} one="record" many="records" />
                  </span>
                </Row>
              </>
            ) : state?.status === "error" ? (
              <div className="flex items-center justify-between gap-4 py-3 text-[13px] text-field-muted">
                This site&apos;s record could not be loaded. The map is unaffected.
                <button type="button" onClick={onRetry} className="shrink-0 text-field-text underline underline-offset-4">
                  Try again
                </button>
              </div>
            ) : (
              [0, 1].map((i) => (
                <div key={i} className="flex justify-between py-3" aria-hidden>
                  <span className="h-4 w-28 rounded-sm bg-field-raised" />
                  <span className="h-4 w-20 rounded-sm bg-field-raised" />
                </div>
              ))
            )}
          </dl>
          <p className="text-[13px] leading-normal text-field-muted">
            Approved evidence counts photo submissions that passed two independent reviews. It is not a count of what was planted.
          </p>
        </section>

        <section aria-labelledby="reviewers" className="drawer-rise space-y-3" style={rise(2)}>
          <h3 id="reviewers" className="text-[15px] font-medium">
            Reviewed by
          </h3>
          {state?.status === "ready" ? (
            state.verifierOrgNames.length ? (
              <ul className="space-y-1 text-[15px]">
                {state.verifierOrgNames.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-field-muted">No independent organisation is assigned yet.</p>
            )
          ) : (
            <span aria-hidden className="block h-4 w-48 rounded-sm bg-field-raised" />
          )}
        </section>

        <details className="drawer-rise group space-y-3 border-t border-field-hairline pt-4" style={rise(3)}>
          <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-medium [&::-webkit-details-marker]:hidden">
            How this location is protected
            <ChevronRight aria-hidden className="size-4 text-field-muted transition-transform group-open:rotate-90" />
          </summary>
          <div className="space-y-3 pt-3 text-[13px] leading-normal text-field-muted">
            {site.area.kind === "exact" ? (
              <p>You see the exact boundary because your organisation owns or reviews this site. The public sees only the approximate area.</p>
            ) : (
              <p>
                The area is the 5.5 km grid cell holding the site&apos;s centre, centred on{" "}
                <span className="rounded border border-field-hairline bg-field-raised px-1.5 py-0.5 font-mono text-[12px] tabular-nums text-field-text">
                  {formatLatLon(site.area.center)}
                </span>
                . The boundary itself is never sent to this page.
              </p>
            )}
            {site.commitment && (
              <>
                <p>The registered boundary is sealed with a commitment: a fingerprint that proves later which boundary was registered, without revealing it now.</p>
                <HashDisplay hash={site.commitment} variant="truncated" label="Commitment" theme="field" />
              </>
            )}
          </div>
        </details>

        <div className="drawer-rise border-t border-field-hairline pt-4" style={rise(4)}>
          <Link
            href={`/p/${site.id}`}
            className={cn(
              "flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-field-hairline bg-field-raised text-[13px] font-medium text-field-text transition-colors hover:bg-field-canopy",
              focusRing
            )}
          >
            <span>View public project record</span>
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-field-muted">{term}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function Count({ n, one, many }: { n: number; one: string; many: string }) {
  return (
    <>
      <span className="font-mono tabular-nums">{formatCount(n)}</span> {n === 1 ? one : many}
    </>
  );
}
