"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as React from "react";
import type {
  ExpressionSpecification,
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MapLibreMap,
  MapLayerMouseEvent,
} from "maplibre-gl";
import { Minus, Plus, Scan } from "lucide-react";
import { FUZZ_CELLS_PER_DEGREE } from "@/src/lib/geo/fuzz";
import { activityColor } from "@/src/lib/activity";
import { formatLatLon } from "@/src/lib/format";
import { cn } from "@/src/lib/utils";
import type { AtlasSite } from "./types";

// Keyless open vector tiles (docs/07-DEPENDENCIES.md); MapLibre adds their attribution.
const VECTOR = "https://tiles.openfreemap.org/styles/positron";
// Sentinel-2 cloudless 2016 by EOX: CC BY 4.0 and free on the public endpoint at reasonable
// traffic. The 2017-and-later layers are non-commercial only, so they are not used.
const SATELLITE = {
  tiles: ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg"],
  attribution:
    '<a href="https://cloudless.eox.at" target="_blank" rel="noopener">EOxCloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)',
};

const WHITE = "#FFFFFF";
const TEXT = "#17221F";
const HALF_CELL = 0.5 / FUZZ_CELLS_PER_DEGREE;
const COLOR: ExpressionSpecification = ["get", "color"];

/** Positron warmed to the workspace's sand: water and green read as colour, the sites carry the rest. */
const DAYLIGHT: [layer: string, property: string, value: string][] = [
  ["background", "background-color", "#F4F0E6"],
  ["water", "fill-color", "#BCD9E8"],
  ["waterway", "line-color", "#A9CEE2"],
  ["park", "fill-color", "#DCEAD0"],
  ["landcover_wood", "fill-color", "#D5E6C8"],
  ["landuse_residential", "fill-color", "#ECE6DA"],
  ["building", "fill-color", "#E4DDCF"],
  ["boundary_2", "line-color", "#B9B1A2"],
  ["boundary_3", "line-color", "#CFC8BA"],
];

export type AtlasPadding = { top: number; right: number; bottom: number; left: number };
export type Basemap = "satellite" | "map";

export interface AtlasMapProps {
  sites: AtlasSite[];
  selectedId?: string | null;
  hoveredId?: string | null;
  onSelect?: (id: string | null) => void;
  onHover?: (id: string | null) => void;
  /** "preview" is a still frame for the landing page: no gestures, no controls. */
  variant?: "explore" | "preview";
  basemap?: Basemap;
  /** Space the camera keeps clear for overlaid panels. Read when the camera moves. */
  padding?: AtlasPadding;
  className?: string;
}

const EVEN_PADDING: AtlasPadding = { top: 48, right: 48, bottom: 48, left: 48 };

/** zoom: a step in or out; null fits every site. */
const CONTROLS = [
  { label: "Zoom in", Icon: Plus, zoom: 1 },
  { label: "Zoom out", Icon: Minus, zoom: -1 },
  { label: "Show all sites", Icon: Scan, zoom: null },
] as const;

/** The drawn area: the grid cell for an approximate site (exactly what fuzzing hides), the ring for exact. */
function areaRing(site: AtlasSite): [number, number][] {
  if (site.area.kind === "exact") return site.area.ring;
  const [lon, lat] = site.area.center;
  const [w, e, s, n] = [lon - HALF_CELL, lon + HALF_CELL, lat - HALF_CELL, lat + HALF_CELL];
  return [[w, s], [e, s], [e, n], [w, n], [w, s]];
}

function toGeoJson(sites: AtlasSite[]) {
  return {
    areas: {
      type: "FeatureCollection" as const,
      features: sites.map((s) => ({
        type: "Feature" as const,
        properties: { id: s.id, kind: s.area.kind, color: activityColor(s.activity) },
        geometry: { type: "Polygon" as const, coordinates: [areaRing(s)] },
      })),
    },
    points: {
      type: "FeatureCollection" as const,
      features: sites.map((s) => ({
        type: "Feature" as const,
        properties: { id: s.id, title: s.title, color: activityColor(s.activity) },
        geometry: { type: "Point" as const, coordinates: s.area.center },
      })),
    },
  };
}

function boundsOf(rings: [number, number][][]): LngLatBoundsLike | null {
  const pts = rings.flat();
  if (!pts.length) return null;
  const lons = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** selected, else hovered, else resting. */
const byState = (rest: number, selected: number, hovered: number): ExpressionSpecification => [
  "case",
  ["boolean", ["feature-state", "hover"], false],
  hovered,
  ["boolean", ["feature-state", "selected"], false],
  selected,
  rest,
];

// Below zoom 9 a 5.5 km cell is a few pixels wide, so a dot stands in for it and hands over.
const areaFade = (value: number | ExpressionSpecification): ExpressionSpecification => ["interpolate", ["linear"], ["zoom"], 7.5, 0, 9, value];
const dotFade: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 8.5, 1, 9.5, 0];

/** Imagery lies over the forest vector map, so the map shows at once and the photos cover it as they load. */
function applyBasemap(map: MapLibreMap, basemap: Basemap) {
  if (map.getLayer("satellite")) map.setLayoutProperty("satellite", "visibility", basemap === "satellite" ? "visible" : "none");
}

export function AtlasMap({
  sites,
  selectedId = null,
  hoveredId = null,
  onSelect,
  onHover,
  variant = "explore",
  basemap = "map",
  padding = EVEN_PADDING,
  className,
}: AtlasMapProps) {
  const explore = variant === "explore";
  const container = React.useRef<HTMLDivElement>(null);
  const readout = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  // Map handlers are bound once; they read the latest props through this.
  const latest = React.useRef({ onSelect, onHover, sites, padding, basemap });
  React.useEffect(() => {
    latest.current = { onSelect, onHover, sites, padding, basemap };
  });

  const fitAll = React.useCallback((animate: boolean) => {
    const map = mapRef.current;
    const bounds = boundsOf(latest.current.sites.map(areaRing));
    if (map && bounds) {
      map.fitBounds(bounds, { padding: latest.current.padding, maxZoom: 9, duration: animate && !reducedMotion() ? 600 : 0 });
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    void import("maplibre-gl").then(({ default: maplibregl }) => {
      if (cancelled || !container.current) return;
      map = new maplibregl.Map({
        container: container.current,
        style: VECTOR,
        center: [90.3, 23.7],
        zoom: 6,
        interactive: explore,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
      mapRef.current = map;
      // Attribution is required by both sources' terms, so it sits where no panel can cover it.
      map.addControl(new maplibregl.AttributionControl({ compact: true }), explore ? "bottom-left" : "bottom-right");
      if (explore) map.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 96 }), "bottom-left");

      // An error before the first load means there is no map; after it, a missing tile is noise.
      let loaded = false;
      map.on("error", () => {
        if (!loaded && !cancelled) setFailed(true);
      });

      map.on("load", () => {
        if (cancelled || !map) return;
        loaded = true;
        setFailed(false);
        for (const [layer, prop, value] of DAYLIGHT) {
          if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value);
        }
        // One script for place names, ink on white. The preview keeps only countries.
        for (const { id, type } of map.getStyle().layers) {
          if (type !== "symbol") continue;
          if (/^(label_|water_name)/.test(id) && (explore || id.startsWith("label_country"))) {
            map.setLayoutProperty(id, "text-field", ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name:latin"], ["get", "name"]]);
            map.setPaintProperty(id, "text-color", id.startsWith("water") ? "#4D7E98" : "#6A746F");
            map.setPaintProperty(id, "text-halo-color", WHITE);
            map.setPaintProperty(id, "text-halo-width", 1.2);
          } else {
            map.setLayoutProperty(id, "visibility", "none");
          }
        }
        // Imagery sits over the basemap's fills and lines and under every label.
        const firstLabel = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
        map.addSource("satellite", { type: "raster", tiles: SATELLITE.tiles, tileSize: 256, maxzoom: 15, attribution: SATELLITE.attribution });
        map.addLayer({ id: "satellite", type: "raster", source: "satellite", paint: { "raster-saturation": -0.1, "raster-brightness-max": 0.92, "raster-fade-duration": 400 } }, firstLabel);

        const data = toGeoJson(latest.current.sites);
        map.addSource("areas", { type: "geojson", data: data.areas, promoteId: "id" });
        map.addSource("points", { type: "geojson", data: data.points, promoteId: "id" });
        map.addLayer({ id: "areas-fill", type: "fill", source: "areas", paint: { "fill-color": COLOR, "fill-opacity": areaFade(byState(0.18, 0.34, 0.42)) } });
        map.addLayer({
          id: "areas-line-approx",
          type: "line",
          source: "areas",
          filter: ["==", ["get", "kind"], "approximate"],
          paint: { "line-color": COLOR, "line-width": byState(1.75, 3, 2.75), "line-dasharray": [2, 1.5], "line-opacity": areaFade(1) },
        });
        map.addLayer({
          id: "areas-line-exact",
          type: "line",
          source: "areas",
          filter: ["==", ["get", "kind"], "exact"],
          paint: { "line-color": COLOR, "line-width": byState(2, 3.5, 3), "line-opacity": areaFade(1) },
        });
        // The pulse: a ring that breathes on the hovered (or open) site. Driven below, never on load.
        map.addLayer({ id: "areas-pulse", type: "line", source: "areas", filter: ["==", ["get", "id"], ""], paint: { "line-color": COLOR, "line-width": 2, "line-opacity": 0 } });
        map.addLayer({
          id: "points-pulse",
          type: "circle",
          source: "points",
          filter: ["==", ["get", "id"], ""],
          paint: { "circle-color": "transparent", "circle-stroke-color": COLOR, "circle-stroke-width": 2, "circle-radius": 8, "circle-stroke-opacity": 0 },
        });
        map.addLayer({
          id: "points-dot",
          type: "circle",
          source: "points",
          paint: {
            "circle-color": COLOR,
            "circle-radius": byState(7, 9, 9),
            "circle-stroke-color": WHITE,
            "circle-stroke-width": 2.5,
            "circle-opacity": dotFade,
            "circle-stroke-opacity": dotFade,
          },
        });
        map.addLayer({
          id: "points-label",
          type: "symbol",
          source: "points",
          layout: {
            "text-field": ["get", "title"],
            "text-font": ["Noto Sans Regular"],
            "text-size": 12.5,
            "text-offset": [0, 1.3],
            "text-anchor": "top",
            "text-max-width": 12,
            "text-optional": true,
          },
          paint: { "text-color": TEXT, "text-halo-color": WHITE, "text-halo-width": 1.8 },
        });
        applyBasemap(map, latest.current.basemap);

        if (explore) {
          let hovered: string | null = null;
          const idAt = (e: MapLayerMouseEvent) => {
            const id = map!.queryRenderedFeatures(e.point, { layers: ["areas-fill", "points-dot"] })[0]?.properties?.id;
            return typeof id === "string" ? id : null;
          };
          const setHover = (id: string | null) => {
            if (id === hovered) return;
            hovered = id;
            map!.getCanvas().style.cursor = id ? "pointer" : "";
            latest.current.onHover?.(id);
          };
          map.on("mousemove", (e) => {
            setHover(idAt(e));
            if (readout.current) {
              readout.current.textContent = `${formatLatLon([e.lngLat.lng, e.lngLat.lat])}  ·  zoom ${map!.getZoom().toFixed(1)}`;
            }
          });
          map.on("mouseout", () => {
            setHover(null);
            if (readout.current) readout.current.textContent = "";
          });
          map.on("click", (e) => latest.current.onSelect?.(idAt(e)));
        }

        fitAll(false); // no fly-in on load: it disorients (docs/14-PAGE-SPEC.md §2)
        setReady(true);
      });
    });
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [explore, fitAll]);

  React.useEffect(() => {
    if (ready && mapRef.current) applyBasemap(mapRef.current, basemap);
  }, [basemap, ready]);

  // A filter changed: swap the data, leave the camera where the reader put it.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const data = toGeoJson(sites);
    (map.getSource("areas") as GeoJSONSource | undefined)?.setData(data.areas);
    (map.getSource("points") as GeoJSONSource | undefined)?.setData(data.points);
  }, [sites, ready]);

  // Selection and hover are feature state, so restyling never re-uploads data.
  const prevSelected = React.useRef<string | null>(null);
  const prevHovered = React.useRef<string | null>(null);
  const flag = React.useCallback((key: "selected" | "hover", id: string | null, prev: React.RefObject<string | null>) => {
    const map = mapRef.current;
    if (!map) return;
    for (const source of ["areas", "points"]) {
      if (prev.current) map.setFeatureState({ source, id: prev.current }, { [key]: false });
      if (id) map.setFeatureState({ source, id }, { [key]: true });
    }
    prev.current = id;
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    flag("selected", selectedId, prevSelected);
    const site = latest.current.sites.find((s) => s.id === selectedId);
    const bounds = site && boundsOf([areaRing(site)]);
    // Moving to the opened site shows where it is. Only on a reader's choice, never on load.
    if (bounds) mapRef.current?.fitBounds(bounds, { padding: latest.current.padding, maxZoom: 11.5, duration: reducedMotion() ? 0 : 600 });
  }, [selectedId, ready, flag]);

  React.useEffect(() => {
    if (ready) flag("hover", hoveredId, prevHovered);
  }, [hoveredId, ready, flag]);

  // The pulse follows the hovered site, else the open one, so list and map read as one thing.
  const pulseId = hoveredId ?? selectedId;
  React.useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const filter: ExpressionSpecification = ["==", ["get", "id"], pulseId ?? ""];
    map.setFilter("areas-pulse", filter);
    map.setFilter("points-pulse", filter);
    if (!pulseId) return;
    if (reducedMotion()) {
      map.setPaintProperty("areas-pulse", "line-opacity", areaFade(0.5));
      map.setPaintProperty("areas-pulse", "line-width", 6);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = ((now - start) % 1400) / 1400; // one breath every 1.4 s
      map.setPaintProperty("areas-pulse", "line-width", 2 + t * 10);
      map.setPaintProperty("areas-pulse", "line-opacity", areaFade(0.75 * (1 - t)));
      map.setPaintProperty("points-pulse", "circle-radius", 8 + t * 16);
      map.setPaintProperty("points-pulse", "circle-stroke-opacity", ["interpolate", ["linear"], ["zoom"], 8.5, 0.8 * (1 - t), 9.5, 0]);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      map.setPaintProperty("areas-pulse", "line-opacity", 0);
      map.setPaintProperty("points-pulse", "circle-stroke-opacity", 0);
    };
  }, [pulseId, ready]);

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    map?.easeTo({ zoom: map.getZoom() + delta, duration: reducedMotion() ? 0 : 200 });
  };

  return (
    <div className={cn("relative overflow-hidden bg-field-stage", explore && "atlas-explore", className)}>
      <div
        ref={container}
        role={explore ? "region" : "img"}
        aria-label={explore ? "Map of restoration sites" : `Map of ${sites.length} restoration sites, shown as approximate areas`}
        className={cn("absolute inset-0 opacity-0 motion-safe:transition-opacity motion-safe:duration-500", ready && "opacity-100")}
      />

      {failed && (
        <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-sm text-field-muted">
          The basemap could not be loaded. Every site is still listed, and nothing else is affected.
        </p>
      )}

      {explore && (
        <>
          {/* Insets come from the layout (--atlas-inset-*), so overlaid panels never cover the controls. */}
          <div
            className="hud absolute z-10 flex flex-col overflow-hidden"
            style={{ left: "calc(var(--atlas-inset-left, 0px) + 16px)", bottom: "calc(var(--atlas-inset-bottom, 0px) + 16px)" }}
          >
            {CONTROLS.map(({ label, Icon, zoom }, i) => (
              <button
                key={label}
                type="button"
                onClick={() => (zoom === null ? fitAll(true) : zoomBy(zoom))}
                aria-label={label}
                title={label}
                className={cn(
                  "flex size-10 items-center justify-center text-field-text transition-colors hover:bg-field-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal pointer-coarse:size-11",
                  i > 0 && "border-t border-field-hairline",
                )}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            ))}
          </div>
          {/* The pointer's position, as a cartographer's instrument reads it. Desktop only. */}
          <div
            ref={readout}
            aria-hidden
            className="pointer-events-none absolute top-4 z-10 hidden whitespace-pre font-mono text-[11px] tabular-nums text-field-muted [text-shadow:0_1px_2px_#FFFFFF] pointer-fine:block"
            style={{ left: "calc(var(--atlas-inset-left, 0px) + 16px)" }}
          />
        </>
      )}
    </div>
  );
}
