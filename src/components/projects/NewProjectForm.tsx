"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as React from "react";
import { useRouter } from "next/navigation";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { Undo2 } from "lucide-react";

// Keyless open vector tiles, as on the Atlas (docs/07-DEPENDENCIES.md).
const STYLE = "https://tiles.openfreemap.org/styles/positron";
const LINE = "#1F7A58";

type Ring = [number, number][];
export type NewProject = { ownerOrgId: string; title: string; activityType: string; claimedQuantity?: number; claimedUnit?: string; boundary: { type: "Polygon"; coordinates: Ring[] } };
type Create = (input: NewProject) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;

const field = "h-11 w-full rounded-xl border border-field-hairline bg-white px-3 text-[15px] focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20";
const label = "block space-y-1.5 text-[14px] font-medium";

/** What the map draws: the corners placed so far, the edge between them, and the area once there are three. */
const shape = (points: Ring) => ({
  type: "FeatureCollection" as const,
  features: [
    ...(points.length >= 3 ? [{ type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [[...points, points[0]!]] } }] : []),
    ...(points.length === 2 ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: points } }] : []),
    ...points.map((p) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: p } })),
  ],
});

/**
 * /projects/new (docs/05-ROUTES.md §3): a project's details, and its boundary drawn on a map,
 * corner by corner, never typed as coordinates. The boundary is sent once, to be stored
 * privately; the public only ever sees an approximate area.
 */
export function NewProjectForm({ orgs, activities, create }: { orgs: { id: string; name: string }[]; activities: { value: string; label: string }[]; create: Create }) {
  const router = useRouter();
  const mapEl = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const [points, setPoints] = React.useState<Ring>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

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
        map.addSource("draft", { type: "geojson", data: shape([]) });
        map.addLayer({ id: "draft-fill", type: "fill", source: "draft", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": LINE, "fill-opacity": 0.18 } });
        map.addLayer({ id: "draft-line", type: "line", source: "draft", filter: ["!=", ["geometry-type"], "Point"], paint: { "line-color": LINE, "line-width": 2.5 } });
        map.addLayer({ id: "draft-corners", type: "circle", source: "draft", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5.5, "circle-color": "#fff", "circle-stroke-color": LINE, "circle-stroke-width": 2.5 } });
        mapRef.current = map;
      });
      map.on("click", (e) => {
        setError(null); // "mark three corners" must not stay on screen once corners are being placed
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

  // onSubmit, not a form action: React empties the fields after an action, so a refused boundary would wipe what was typed
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    if (points.length < 3) return setError("Mark at least three corners of the site on the map.");
    const quantity = String(form.get("claimedQuantity") ?? "").trim();
    const unit = String(form.get("claimedUnit") ?? "").trim();
    start(async () => {
      const res = await create({
        ownerOrgId: String(form.get("ownerOrgId")),
        title: String(form.get("title") ?? "").trim(),
        activityType: String(form.get("activityType")),
        ...(quantity ? { claimedQuantity: Number(quantity) } : {}),
        ...(unit ? { claimedUnit: unit } : {}),
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
          <input name="title" required minLength={3} maxLength={120} placeholder="Koyra Mangrove Belt, Khulna" className={field} />
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
            <input name="claimedQuantity" type="number" min="0" step="any" inputMode="decimal" placeholder="12000" className={field} />
          </label>
          <label className={label}>
            Unit
            <input name="claimedUnit" maxLength={40} placeholder="saplings" className={field} />
          </label>
        </div>
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
          <div className="flex gap-2">
            <button type="button" disabled={!points.length} onClick={() => setPoints((p) => p.slice(0, -1))} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-field-hairline px-3 text-[14px] disabled:opacity-45">
              <Undo2 className="size-4" aria-hidden />
              Undo
            </button>
            <button type="button" disabled={!points.length} onClick={() => setPoints([])} className="h-9 rounded-lg border border-field-hairline px-3 text-[14px] disabled:opacity-45">
              Start again
            </button>
          </div>
        </div>
        <div ref={mapEl} role="application" aria-label="Map: click to place the corners of the site boundary" className="lift h-[440px] overflow-hidden rounded-2xl border border-field-hairline lg:h-[560px]" />
        <p className="text-[13px] leading-[1.6] text-field-muted">
          The exact boundary is stored privately and never published. The public sees an approximate area about 5.5 km across, and a fingerprint that fixes the boundary without revealing it. It cannot be changed after the project is created.
        </p>
      </div>
    </form>
  );
}
