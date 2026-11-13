"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronRight, MapPin, Search, ShieldCheck } from "lucide-react";
import { HashDisplay } from "@/src/components/hash-display/hash-display";
import { Wordmark } from "@/src/components/site/Wordmark";
import { activityColor } from "@/src/lib/activity";
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

const PANEL = 400;
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
// one hue per figure, the same wherever that figure appears: sites, approved records, anchored records, reviewers
const HUE = { sites: "#13896F", approved: "#1A7A51", anchored: "#4F55C8", reviewers: "#7A57D1" } as const;
const tint = (hex: string, pct = 10) => `color-mix(in srgb, ${hex} ${pct}%, white)`;

/**
 * The Impact Atlas: the map is the page, and one panel floats over it. The panel lists the
 * sites (search, filter by activity) and turns to a site when one is opened; hovering a row
 * lights its place on the map and the other way round.
 */
export function AtlasExplorer({ sites, overview, signedIn, initialSiteId = null }: AtlasExplorerProps) {
  const [activity, setActivity] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [basemap, setBasemap] = React.useState<Basemap>("map");
  const [selectedId, setSelectedId] = React.useState<string | null>(() => (sites.some((s) => s.id === initialSiteId) ? initialSiteId : null));
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [records, setRecords] = React.useState<Record<string, RecordState>>(() => (selectedId ? { [selectedId]: { status: "loading" } } : {}));
  const wide = React.useSyncExternalStore(subscribeWide, () => window.matchMedia(wideQuery).matches, () => true);
  const viewportHeight = React.useSyncExternalStore(subscribeResize, () => window.innerHeight, () => 900);

  const activities = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sites) counts.set(s.activity, (counts.get(s.activity) ?? 0) + 1);
    return [...counts].sort(([a], [b]) => a.localeCompare(b));
  }, [sites]);
  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return sites.filter((s) => (!activity || s.activity === activity) && (!q || `${s.title} ${s.ownerOrgName} ${s.activity}`.toLowerCase().includes(q)));
  }, [sites, activity, query]);
  const exactCount = sites.filter((s) => s.area.kind === "exact").length;
  const selected = sites.find((s) => s.id === selectedId) ?? null;

  // Keep the camera's subject out from under the one panel. Below 900px it is a bottom sheet.
  const padding = React.useMemo<AtlasPadding>(
    () =>
      wide
        ? { top: 72, bottom: 72, left: PANEL + GAP * 2 + 48, right: 72 }
        : { top: 72, left: 32, right: 32, bottom: Math.round(viewportHeight * (selected ? 0.7 : 0.45)) + 32 },
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

  const stats = [
    { n: overview.sites, label: overview.sites === 1 ? "active site" : "active sites", hue: HUE.sites },
    { n: overview.approved, label: "approved records", hue: HUE.approved },
    { n: overview.verifierOrgs, label: overview.verifierOrgs === 1 ? "reviewing organisation" : "reviewing organisations", hue: HUE.reviewers },
  ];

  return (
    <div className="fixed inset-0 h-dvh w-screen overflow-hidden bg-field-stage font-sans text-field-text [--atlas-inset-bottom:45dvh] min-[900px]:[--atlas-inset-bottom:0px] min-[900px]:[--atlas-inset-left:432px]">
      <AtlasMap
        sites={selected ? sites.filter((s) => visible.includes(s) || s.id === selected.id) : visible}
        selectedId={selected?.id ?? null}
        hoveredId={hoveredId}
        onSelect={select}
        onHover={setHoveredId}
        basemap={basemap}
        padding={padding}
        className="absolute inset-0"
      />

      {/* The basemap, as a small switch on the map itself */}
      <div role="group" aria-label="Basemap" className="hud absolute right-4 top-4 z-20 flex p-1">
        {(["map", "satellite"] as const).map((b) => (
          <button
            key={b}
            type="button"
            aria-pressed={basemap === b}
            onClick={() => setBasemap(b)}
            className={cn("h-8 rounded-[10px] px-3.5 text-[13px] font-medium capitalize transition-colors", focusRing, basemap === b ? "bg-signal text-white" : "text-field-muted hover:text-field-text")}
          >
            {b}
          </button>
        ))}
      </div>

      {/* One panel. Opening a site turns the panel to it; nothing opens on the other side. */}
      <aside
        aria-label={selected ? "Site details" : "Sites"}
        className={cn(
          "hud absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-b-none motion-safe:transition-[max-height] motion-safe:duration-300",
          selected ? "max-h-[70dvh]" : "max-h-[45dvh]",
          "min-[900px]:inset-x-auto min-[900px]:bottom-4 min-[900px]:left-4 min-[900px]:top-4 min-[900px]:max-h-none min-[900px]:w-[400px] min-[900px]:rounded-b-[14px]",
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-field-hairline px-5 py-3.5">
          <Link href="/" className={cn("rounded-sm", focusRing)} aria-label="Delta, home">
            <Wordmark className="text-field-text" />
          </Link>
          <nav aria-label="Atlas" className="flex items-center gap-4 text-[14px]">
            <Link href="/verify" className={cn("text-field-muted transition-colors hover:text-field-text", focusRing)}>
              Check a photo
            </Link>
            <Link href={signedIn ? "/dashboard" : "/sign-in?next=/atlas"} className={cn("font-medium text-signal underline-offset-4 hover:underline", focusRing)}>
              {signedIn ? "Workspace" : "Sign in"}
            </Link>
          </nav>
        </div>

        {selected ? (
          <SiteDetail key={selected.id} site={selected} state={records[selected.id]} onClose={() => select(null)} onRetry={() => loadRecord(selected.id)} />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-4 px-5 pt-5">
              <div className="space-y-2">
                <h1 className="font-serif text-[30px] leading-[1.05] tracking-[-0.015em]">Impact atlas</h1>
                <p className="text-[15px] leading-[1.6] text-field-muted">Restoration sites under review by organisations independent of the people doing the work.</p>
              </div>
              <dl className="grid grid-cols-3 gap-2" aria-label="The registry today">
                {stats.map(({ n, label, hue }) => (
                  <div key={label} className="flex flex-col-reverse gap-0.5 rounded-xl px-3 py-2.5" style={{ background: tint(hue) }}>
                    <dt className="text-[12px] leading-[1.3] text-field-muted">{label}</dt>
                    <dd className="font-serif text-[24px] leading-tight tabular-nums" style={{ color: hue }}>
                      {formatCount(n)}
                    </dd>
                  </div>
                ))}
              </dl>

              <label className="relative block">
                <span className="sr-only">Find a site</span>
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-field-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a site or an organisation"
                  className="h-11 w-full rounded-xl border border-field-hairline bg-white pl-9 pr-3 text-[15px] placeholder:text-field-muted focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20"
                />
              </label>

              {activities.length > 1 && (
                <div role="group" aria-label="Filter by activity" className="flex flex-wrap gap-2">
                  {[[null, sites.length] as const, ...activities].map(([value, n]) => {
                    const on = activity === value;
                    const hue = value ? activityColor(value) : "#17221F";
                    return (
                      <button
                        key={value ?? "all"}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setActivity(value)}
                        className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors", focusRing, !on && "border-field-hairline bg-white text-field-text hover:border-field-inert")}
                        style={on ? { background: hue, borderColor: hue, color: "#fff" } : undefined}
                      >
                        {value && <span aria-hidden className="size-2 rounded-full" style={{ background: on ? "#fff" : hue }} />}
                        {value ?? "All"}
                        <span className="font-mono text-[12px] tabular-nums opacity-80">{n}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {visible.length === 0 ? (
              <p className="px-5 py-8 text-[15px] text-field-muted">
                No site matches.{" "}
                <button
                  type="button"
                  className="text-field-text underline underline-offset-4"
                  onClick={() => {
                    setQuery("");
                    setActivity(null);
                  }}
                >
                  Show every site
                </button>
              </p>
            ) : (
              <ul className="space-y-2 px-3 py-4">
                {visible.map((s) => {
                  const lit = s.id === hoveredId;
                  const hue = activityColor(s.activity);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => select(s.id)}
                        onMouseEnter={() => setHoveredId(s.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onFocus={() => setHoveredId(s.id)}
                        onBlur={() => setHoveredId(null)}
                        className={cn(
                          "group flex w-full items-stretch gap-3 overflow-hidden rounded-xl border bg-white text-left transition-[border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
                          lit ? "border-transparent shadow-[0_6px_20px_-8px_rgb(23_34_31/0.28)]" : "border-field-hairline hover:border-field-inert",
                        )}
                        style={lit ? { borderColor: hue } : undefined}
                      >
                        <span aria-hidden className="w-1.5 shrink-0" style={{ background: hue }} />
                        <span className="min-w-0 flex-1 space-y-1 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ background: tint(hue, 12), color: hue }}>
                            {s.activity}
                          </span>
                          <span className="block truncate text-[15px] font-medium">{s.title}</span>
                          <span className="block truncate text-[13px] text-field-muted">
                            {s.ownerOrgName}
                            {s.claim && ` · claims ${s.claim}`}
                          </span>
                        </span>
                        <ChevronRight aria-hidden className="mr-3 size-4 shrink-0 self-center text-field-muted transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="px-5 pb-5">
              <Legend exactCount={exactCount} />
            </div>
          </div>
        )}

        <p className="shrink-0 border-t border-field-hairline px-5 py-3 text-[12px] text-field-muted">Demonstration data, read live from the registry.</p>
      </aside>
    </div>
  );
}

/** Explains the two outline styles. Shown, because a reader cannot guess what dashed means. */
function Legend({ exactCount }: { exactCount: number }) {
  return (
    <dl className="space-y-2 rounded-xl border border-field-hairline bg-field-stage/40 p-3 text-[13px] leading-normal">
      <div className="flex gap-3">
        <dt className="pt-0.5">
          <svg width="16" height="16" aria-hidden className="text-signal">
            <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeDasharray="3 2" />
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
              <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="sr-only">Solid outline</span>
          </dt>
          <dd className="text-field-muted">
            <span className="text-field-text">Exact boundary.</span> Shown for the {exactCount === 1 ? "site" : `${exactCount} sites`} your organisation owns or reviews.
          </dd>
        </div>
      )}
    </dl>
  );
}

function SiteDetail({ site, state, onClose, onRetry }: { site: AtlasSite; state: RecordState | undefined; onClose: () => void; onRetry: () => void }) {
  const rise = (i: number) => ({ "--i": i }) as React.CSSProperties;
  const hue = activityColor(site.activity);
  const ready = state?.status === "ready" ? state : null;
  // the public record counts the two states apart; an anchored record was approved first
  const approvedTotal = ready ? ready.record.approved + ready.record.anchored : undefined;
  const anchoredPct = ready && approvedTotal ? Math.round((ready.record.anchored / approvedTotal) * 100) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* the site's own colour carries the head of the panel */}
      <div className="shrink-0 space-y-3 px-5 pb-5 pt-3" style={{ background: `linear-gradient(180deg, ${tint(hue, 16)}, ${tint(hue, 4)})` }}>
        <button type="button" onClick={onClose} className={cn("-ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[14px] text-field-muted transition-colors hover:bg-white/70 hover:text-field-text", focusRing)}>
          <ArrowLeft className="size-4" aria-hidden />
          All sites
        </button>
        <div className="drawer-rise space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[12px] font-medium" style={{ color: hue }}>
            <span aria-hidden className="size-2 rounded-full" style={{ background: hue }} />
            {site.activity}
          </span>
          <h2 className="font-serif text-[28px] leading-[1.1] tracking-[-0.01em]">{site.title}</h2>
          <p className="text-[14px] text-field-muted">
            {site.ownerOrgName}
            {site.claim ? ` claims ${site.claim}.` : " has stated no quantity."}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 pb-6 pt-5">
        <section aria-labelledby="claim-record" className="drawer-rise space-y-3" style={rise(1)}>
          <h3 id="claim-record" className="text-[15px] font-medium">
            What is on record
          </h3>
          {state?.status === "error" ? (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-field-hairline p-3 text-[13px] text-field-muted">
              This site&apos;s record could not be loaded. The map is unaffected.
              <button type="button" onClick={onRetry} className="shrink-0 text-field-text underline underline-offset-4">
                Try again
              </button>
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["Approved", approvedTotal, "by two independent reviewers", HUE.approved],
                    ["Anchored", ready?.record.anchored, "fingerprint published on chain", HUE.anchored],
                  ] as const
                ).map(([label, n, note, c]) => (
                  <div key={label} className="flex flex-col gap-0.5 rounded-xl px-3.5 py-3" style={{ background: tint(c) }}>
                    <dt className="text-[13px] text-field-muted">{label}</dt>
                    <dd className="font-serif text-[30px] leading-none tabular-nums" style={{ color: c }}>
                      {n === undefined ? <span aria-hidden className="inline-block h-7 w-14 rounded-sm bg-white/70" /> : formatCount(n)}
                    </dd>
                    <dd className="text-[12px] leading-[1.4] text-field-muted">{note}</dd>
                  </div>
                ))}
              </dl>
              {ready && Boolean(approvedTotal) && (
                <div className="space-y-1.5">
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: tint(HUE.approved, 22) }} role="img" aria-label={`${anchoredPct}% of approved records are anchored`}>
                    <div className="grow-x h-full rounded-full" style={{ width: `${anchoredPct}%`, background: HUE.anchored }} />
                  </div>
                  <p className="text-[12px] text-field-muted">{anchoredPct}% of approved records are anchored</p>
                </div>
              )}
            </>
          )}
          <p className="text-[13px] leading-normal text-field-muted">Approved counts photo submissions that passed two independent reviews. It is not a count of what was planted.</p>
        </section>

        <section aria-labelledby="reviewers" className="drawer-rise space-y-3" style={rise(2)}>
          <h3 id="reviewers" className="text-[15px] font-medium">
            Reviewed by
          </h3>
          {ready ? (
            ready.verifierOrgNames.length ? (
              <ul className="space-y-2">
                {ready.verifierOrgNames.map((n) => (
                  <li key={n} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px]" style={{ background: tint(HUE.reviewers, 8) }}>
                    <ShieldCheck aria-hidden className="size-4 shrink-0" style={{ color: HUE.reviewers }} />
                    <span className="min-w-0 flex-1 truncate">{n}</span>
                    <span className="shrink-0 text-[12px] text-field-muted">independent</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-field-muted">No independent organisation is assigned yet.</p>
            )
          ) : state?.status === "error" ? null : (
            <span aria-hidden className="block h-10 rounded-xl bg-field-raised" />
          )}
        </section>

        <details className="drawer-rise group rounded-xl border border-field-hairline" style={rise(3)}>
          <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3.5 py-3 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
            <MapPin aria-hidden className="size-4 shrink-0 text-field-muted" />
            <span className="flex-1">How this location is protected</span>
            <ChevronRight aria-hidden className="size-4 text-field-muted transition-transform group-open:rotate-90" />
          </summary>
          <div className="space-y-3 border-t border-field-hairline px-3.5 py-3 text-[13px] leading-normal text-field-muted">
            {site.area.kind === "exact" ? (
              <p>You see the exact boundary because your organisation owns or reviews this site. The public sees only the approximate area.</p>
            ) : (
              <p>
                The area is the 5.5 km grid cell holding the site&apos;s centre, centred on{" "}
                <span className="rounded border border-field-hairline bg-field-raised px-1.5 py-0.5 font-mono text-[12px] tabular-nums text-field-text">{formatLatLon(site.area.center)}</span>. The boundary itself is never sent
                to this page.
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

        <div className="drawer-rise" style={rise(4)}>
          <Link href={`/p/${site.id}`} className={cn("flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-signal text-[15px] font-medium text-white transition-colors hover:bg-[#14543D]", focusRing)}>
            Open the project record
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
