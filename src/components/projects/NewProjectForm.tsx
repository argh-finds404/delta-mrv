"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as React from "react";
import { useRouter } from "next/navigation";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { AlertTriangle, FileUp, Info, Undo2 } from "lucide-react";
import { checkClaim, MAX_PLANTS_PER_M2 } from "@/src/lib/forensics/claims";
import { formatHectares, ringAreaM2, ringPerimeterM, selfIntersection } from "@/src/lib/geo/area";
import { BoundaryFileError, parseBoundaryFile } from "@/src/lib/geo/boundary-file";
import { cn } from "@/src/lib/utils";

// Keyless open vector tiles, as on the Atlas (docs/07-DEPENDENCIES.md).
const STYLE = "https://tiles.openfreemap.org/styles/positron";
const LINE = "#1F7A58";
/** Past this many corners a file's outline is drawn as a line only: a dot per vertex would hide it. */
const MAX_DRAWN_CORNERS = 60;

type Ring = [number, number][];
export type NewProject = { ownerOrgId: string; title: string; activityType: string; claimedQuantity?: number; claimedUnit?: string; boundary: { type: "Polygon"; coordinates: Ring[] } };
type Create = (input: NewProject) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;

const field = "h-11 w-full rounded-xl border border-field-hairline bg-white px-3 text-[15px] focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20";
const label = "block space-y-1.5 text-[14px] font-medium";
const quiet = "inline-flex h-11 items-center gap-1.5 rounded-lg border border-field-hairline px-3 text-[14px] transition-colors hover:border-field-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-45 sm:h-9";

/** What the map draws: the corners placed so far, the edge between them, and the area once there are three. */
const shape = (points: Ring) => ({
  type: "FeatureCollection" as const,
  features: [
    ...(points.length >= 3 ? [{ type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [[...points, points[0]!]] } }] : []),
    ...(points.length === 2 ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: points } }] : []),
    ...(points.length <= MAX_DRAWN_CORNERS ? points.map((p) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: p } })) : []),
  ],
});

type Imported = { file: string; format: string; corners: number; warnings: string[] };

/**
 * /projects/new (docs/05-ROUTES.md §3): a project's details, and its boundary, drawn on the map
 * corner by corner or read from a GeoJSON or KML file the team already has. The boundary is sent
 * once, to be stored privately; the public only ever sees an approximate area.
 */
export function NewProjectForm({ orgs, activities, create }: { orgs: { id: string; name: string }[]; activities: { value: string; label: string }[]; create: Create }) {
  const router = useRouter();
  const mapEl = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const titleRef = React.useRef<HTMLInputElement>(null);
  const [points, setPoints] = React.useState<Ring>([]);
  const [quantity, setQuantity] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [imported, setImported] = React.useState<Imported | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  // what the map must show once it has loaded: corners placed (or imported) before it was ready,
  // and the bounds of an imported file to zoom to
  const latestPoints = React.useRef<Ring>([]);
  const pendingFit = React.useRef<[number, number, number, number] | null>(null);
  React.useEffect(() => {
    latestPoints.current = points;
  }, [points]);

  React.useEffect(() => {
    let map: MapLibreMap | undefined;
    let gone = false;
    void import("maplibre-gl").then(({ default: maplibregl }) => {
      if (gone || !mapEl.current) return;
      // the Bengal delta, where the demonstration sites are; pan anywhere
      map = new maplibregl.Map({ container: mapEl.current, style: STYLE, center: [90.2, 23.4], zoom: 6, attributionControl: false });
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.getCanvas().style.cursor = "crosshair";
      map.on("load", () => {
        if (!map) return;
        map.addSource("draft", { type: "geojson", data: shape(latestPoints.current) });
        map.addLayer({ id: "draft-fill", type: "fill", source: "draft", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": LINE, "fill-opacity": 0.18 } });
        map.addLayer({ id: "draft-line", type: "line", source: "draft", filter: ["!=", ["geometry-type"], "Point"], paint: { "line-color": LINE, "line-width": 2.5 } });
        map.addLayer({ id: "draft-corners", type: "circle", source: "draft", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5.5, "circle-color": "#fff", "circle-stroke-color": LINE, "circle-stroke-width": 2.5 } });
        mapRef.current = map;
        if (pendingFit.current) map.fitBounds(pendingFit.current, { padding: 56, maxZoom: 17, duration: 0 });
        pendingFit.current = null;
      });
      map.on("click", (e) => {
        setError(null); // "mark three corners" must not stay on screen once corners are being placed
        setImported(null);
        setPoints((p) => [...p, [Number(e.lngLat.lng.toFixed(6)), Number(e.lngLat.lat.toFixed(6))]]);
      });
    });
    return () => {
      gone = true;
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  React.useEffect(() => {
    (mapRef.current?.getSource("draft") as GeoJSONSource | undefined)?.setData(shape(points));
  }, [points]);

  const readFile = async (file: File) => {
    setFileError(null);
    setError(null);
    try {
      if (file.size > 20 * 1024 * 1024) throw new BoundaryFileError("The file is larger than 20 MB. Export the site's outline alone.");
      const parsed = parseBoundaryFile(await file.text(), file.name);
      setPoints(parsed.ring);
      setImported({ file: file.name, format: parsed.format, corners: parsed.ring.length, warnings: parsed.warnings });
      if (parsed.name && titleRef.current && !titleRef.current.value.trim()) titleRef.current.value = parsed.name.slice(0, 120);
      const lons = parsed.ring.map((p) => p[0]);
      const lats = parsed.ring.map((p) => p[1]);
      const bounds: [number, number, number, number] = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
      if (mapRef.current) mapRef.current.fitBounds(bounds, { padding: 56, maxZoom: 17, duration: 600 });
      else pendingFit.current = bounds; // the map is still loading: it zooms there when ready
    } catch (e) {
      setFileError(e instanceof BoundaryFileError ? e.message : "The file could not be read.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const area = points.length >= 3 ? ringAreaM2(points) : 0;
  const crossing = points.length >= 4 ? selfIntersection(points) : null;
  const claim = checkClaim(quantity.trim() ? Number(quantity) : null, unit, area);

  // onSubmit, not a form action: React empties the fields after an action, so a refused boundary would wipe what was typed
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    if (points.length < 3) return setError("Mark at least three corners of the site on the map, or import a boundary file.");
    if (crossing) return setError(`The boundary crosses itself between corners ${crossing[0]} and ${crossing[1]}. Undo the last corners or start again.`);
    start(async () => {
      const res = await create({
        ownerOrgId: String(form.get("ownerOrgId")),
        title: String(form.get("title") ?? "").trim(),
        activityType: String(form.get("activityType")),
        ...(quantity.trim() ? { claimedQuantity: Number(quantity) } : {}),
        ...(unit.trim() ? { claimedUnit: unit.trim() } : {}),
        boundary: { type: "Polygon", coordinates: [[...points, points[0]!]] },
      });
      if (res.ok) router.push(`/projects/${res.id}`);
      else setError(res.error);
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="space-y-5">
        {orgs.length > 1 ? (
          <label className={label}>
            Organisation
            <select name="ownerOrgId" className={field} defaultValue={orgs[0]!.id}>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="ownerOrgId" value={orgs[0]!.id} />
        )}
        <label className={label}>
          Project name
          <input ref={titleRef} name="title" required minLength={3} maxLength={120} placeholder="Koyra Mangrove Belt, Khulna" className={field} />
        </label>
        <label className={label}>
          Kind of restoration
          <select name="activityType" className={field} defaultValue={activities[0]!.value}>
            {activities.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            What you claim <span className="font-normal text-field-muted">(optional)</span>
            <input name="claimedQuantity" type="number" min="0" step="any" inputMode="decimal" placeholder="12000" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={field} />
          </label>
          <label className={label}>
            Unit
            <input name="claimedUnit" maxLength={40} placeholder="saplings" value={unit} onChange={(e) => setUnit(e.target.value)} className={field} />
          </label>
        </div>
        <ClaimHint claim={claim} />
        <p className="text-[13px] leading-[1.6] text-field-muted">
          The claim is yours and is shown as yours. Delta records the evidence and who reviewed it; it does not confirm the number.
        </p>
        {error && (
          <p role="alert" className="rounded-xl border border-fraud/40 bg-white px-3 py-2.5 text-[14px] text-fraud">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-signal px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#14543D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-55"
        >
          {pending ? "Creating…" : "Create the project"}
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] font-medium">
            The site boundary{" "}
            <span className="font-normal text-field-muted" data-testid="corner-count">
              {points.length === 0 ? "click the map to place each corner" : `${points.length} ${points.length === 1 ? "corner" : "corners"} placed`}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className={quiet}>
              <FileUp className="size-4" aria-hidden />
              Import a file
            </button>
            <button
              type="button"
              disabled={!points.length}
              onClick={() => {
                setImported(null);
                setPoints((p) => p.slice(0, -1));
              }}
              className={quiet}
            >
              <Undo2 className="size-4" aria-hidden />
              Undo
            </button>
            <button
              type="button"
              disabled={!points.length}
              onClick={() => {
                setImported(null);
                setPoints([]);
              }}
              className={quiet}
            >
              Start again
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".geojson,.json,.kml,application/geo+json,application/vnd.google-earth.kml+xml"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void readFile(f);
            }}
          />
        </div>

        <div
          className="relative"
          onDragEnter={(e) => {
            if (e.dataTransfer.types.includes("Files")) setDragging(true);
          }}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) void readFile(f);
          }}
        >
          <div ref={mapEl} role="application" aria-label="Map: click to place the corners of the site boundary" className="lift h-[440px] overflow-hidden rounded-2xl border border-field-hairline lg:h-[560px]" />
          {dragging && (
            <div aria-hidden className="pattern-dots pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-dashed border-signal bg-field-canopy/90">
              <p className="flex items-center gap-2 text-[16px] font-medium text-field-text">
                <FileUp className="size-5 text-signal" />
                Drop to use this boundary
              </p>
            </div>
          )}
        </div>

        <div aria-live="polite" className="space-y-2">
          {fileError && (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-fraud/40 bg-white px-3 py-2.5 text-[14px] text-fraud">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {fileError}
            </p>
          )}
          {imported && (
            <div className="rounded-xl border border-field-hairline bg-field-canopy px-3 py-2.5 text-[14px]" data-testid="boundary-imported">
              <p>
                <span className="font-medium">Imported {imported.file}</span> <span className="text-field-muted">({imported.format}, {imported.corners} corners)</span>
              </p>
              {imported.warnings.map((w) => (
                <p key={w} className="mt-1 flex items-start gap-2 text-review">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {w}
                </p>
              ))}
            </div>
          )}
          {points.length >= 3 && (
            <p className="text-[14px] text-field-muted" data-testid="boundary-measure">
              About <span className="font-medium tabular-nums text-field-text">{formatHectares(area)}</span>, a perimeter of{" "}
              <span className="tabular-nums">{(ringPerimeterM(points) / 1000).toLocaleString("en-GB", { maximumFractionDigits: 2 })} km</span>.
              {crossing && <span className="text-fraud"> The edges from corners {crossing[0]} and {crossing[1]} cross.</span>}
            </p>
          )}
        </div>

        <p className="text-[13px] leading-[1.6] text-field-muted">
          Draw it by clicking each corner, or import the outline from QGIS, a GPS unit or Google Earth as GeoJSON or KML (drop the file on the map). The exact boundary is stored privately and never
          published: the public sees an approximate area about 5.5 km across, and a fingerprint that fixes the boundary without revealing it. It cannot be changed after the project is created.
        </p>
      </div>
    </form>
  );
}

/** The claim against the area drawn, as the reviewers' check will read it (claims.v1), before anything is sent. */
function ClaimHint({ claim }: { claim: ReturnType<typeof checkClaim> }) {
  if (claim.kind === "none") return null;
  const warn = claim.kind === "area" ? claim.exceeds : claim.implausible;
  const text =
    claim.kind === "area"
      ? claim.exceeds
        ? `That is ${claim.ratio.toFixed(1)} times the ${formatHectares(claim.boundaryM2)} you drew. Reviewers will see a finding saying so.`
        : `Fits within the ${formatHectares(claim.boundaryM2)} you drew.`
      : `About ${Math.round(claim.perHectare).toLocaleString("en-GB")} per hectare (${claim.perSquareMetre.toLocaleString("en-GB", { maximumFractionDigits: 2 })} per m²)${
          claim.implausible ? `: more than ${MAX_PLANTS_PER_M2} per m², denser than any planting method. Reviewers will see a finding saying so.` : "."
        }`;
  return (
    <p className={cn("flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[14px] leading-[1.5]", warn ? "border-review/30 bg-review/10 text-review" : "border-field-hairline bg-field-canopy text-field-muted")} data-testid="claim-hint">
      {warn ? <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Info className="mt-0.5 size-4 shrink-0" aria-hidden />}
      {text}
    </p>
  );
}
