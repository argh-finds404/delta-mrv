// A site boundary from a file the team already has: GeoJSON (QGIS, geojson.io) or KML (Google
// Earth, GPS handhelds), read in the browser to the one open ring /projects/new draws. One area
// per project: several separate areas are refused by count, holes are left out with a note.
// What the server accepts is still the server's call (projects.service, then PostGIS ST_IsValid).
import { selfIntersection } from "./area";

export type Ring = [number, number][];
export type ParsedBoundary = { ring: Ring; format: "GeoJSON" | "KML"; warnings: string[]; name: string | null };

export class BoundaryFileError extends Error {}

/** Beyond this the map would draw a corner per vertex for nothing: export a simplified outline. */
export const MAX_VERTICES = 10_000;
const WGS84 = /^(EPSG:?:?4326|urn:ogc:def:crs:OGC:1\.3:CRS84|urn:ogc:def:crs:EPSG::4326|CRS84)$/i;

const fail = (why: string): never => {
  throw new BoundaryFileError(why);
};

/** Drops altitude and the closing point, removes repeated corners, checks the ring can be a site. */
function cleanRing(raw: unknown[], where: string): Ring {
  const out: Ring = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 2 || typeof p[0] !== "number" || typeof p[1] !== "number" || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
      fail(`${where} has a position that is not a pair of numbers.`);
    }
    const [lon, lat] = [Number((p as number[])[0]!.toFixed(7)), Number((p as number[])[1]!.toFixed(7))];
    if (lon < -180 || lon > 180) fail(`${where} has a longitude of ${lon}, outside -180 to 180. The file may use a projected system: export it as WGS 84 (EPSG:4326).`);
    if (lat < -90 || lat > 90) fail(`${where} has a latitude of ${lat}, outside -90 to 90. The file may use a projected system: export it as WGS 84 (EPSG:4326).`);
    const last = out.at(-1);
    if (!last || last[0] !== lon || last[1] !== lat) out.push([lon, lat]);
  }
  if (out.length > 1 && out[0]![0] === out.at(-1)![0] && out[0]![1] === out.at(-1)![1]) out.pop();
  if (out.length < 3) fail(`${where} needs at least three distinct corners.`);
  if (out.length > MAX_VERTICES) fail(`${where} has ${out.length.toLocaleString("en-GB")} corners. Simplify the outline to under ${MAX_VERTICES.toLocaleString("en-GB")} and try again.`);
  const crossing = selfIntersection(out);
  if (crossing) fail(`The boundary crosses itself: the edges from corner ${crossing[0]} and corner ${crossing[1]} meet. Fix the outline in your GIS tool and export it again.`);
  return out;
}

const holeNote = (n: number) => `The file's polygon has ${n} ${n === 1 ? "hole" : "holes"}. Delta keeps the outer edge only, so the area below includes ${n === 1 ? "it" : "them"}.`;

function fromGeoJson(doc: unknown): ParsedBoundary {
  const polygons: { rings: unknown[][]; name: string | null }[] = [];
  const visit = (node: unknown, name: string | null) => {
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    const crs = (o.crs as { properties?: { name?: unknown } } | undefined)?.properties?.name;
    if (typeof crs === "string" && !WGS84.test(crs)) fail(`The file says its coordinates are in ${crs}. Export it as WGS 84 (EPSG:4326) longitude and latitude.`);
    const ownName = typeof (o.properties as { name?: unknown } | undefined)?.name === "string" ? ((o.properties as { name: string }).name) : name;
    switch (o.type) {
      case "FeatureCollection":
        for (const f of (o.features as unknown[]) ?? []) visit(f, ownName);
        return;
      case "Feature":
        return visit(o.geometry, ownName);
      case "GeometryCollection":
        for (const g of (o.geometries as unknown[]) ?? []) visit(g, ownName);
        return;
      case "Polygon":
        if (Array.isArray(o.coordinates)) polygons.push({ rings: o.coordinates as unknown[][], name: ownName });
        return;
      case "MultiPolygon":
        for (const p of (o.coordinates as unknown[][][]) ?? []) polygons.push({ rings: p, name: ownName });
        return;
    }
  };
  visit(doc, null);
  if (!polygons.length) fail("The file has no polygon. A site boundary is a closed area: export the outline as a polygon, not as a line or points.");
  if (polygons.length > 1) fail(`The file has ${polygons.length} separate areas. A Delta project has one boundary: register each area as its own project, or merge them in your GIS tool.`);
  const [{ rings, name }] = polygons as [(typeof polygons)[number]];
  const ring = cleanRing(rings[0] ?? [], "The boundary");
  return { ring, format: "GeoJSON", warnings: rings.length > 1 ? [holeNote(rings.length - 1)] : [], name };
}

// KML is XML, but only three elements matter here; a namespace prefix is allowed on each.
const tag = (name: string) => new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, "g");

function fromKml(text: string): ParsedBoundary {
  const polygons = [...text.matchAll(tag("Polygon"))].map((m) => m[1]!);
  if (!polygons.length) fail("The file has no polygon. A site boundary is a closed area: in Google Earth, draw it with Add Polygon, then save it as KML.");
  if (polygons.length > 1) fail(`The file has ${polygons.length} separate areas. A Delta project has one boundary: register each area as its own project, or keep one polygon in the file.`);
  const body = polygons[0]!;
  const outer = [...body.matchAll(tag("outerBoundaryIs"))][0]?.[1];
  const coords = outer ? [...outer.matchAll(tag("coordinates"))][0]?.[1] : undefined;
  if (!coords) fail("The polygon in the file has no outer boundary coordinates.");
  const positions = coords!
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.split(",").map(Number));
  const ring = cleanRing(positions, "The boundary");
  const holes = [...body.matchAll(tag("innerBoundaryIs"))].length;
  const name = [...text.matchAll(tag("name"))][0]?.[1]?.trim() || null;
  return { ring, format: "KML", warnings: holes ? [holeNote(holes)] : [], name };
}

/** The boundary in a .geojson, .json or .kml file's text. Throws BoundaryFileError with a reason a person can act on. */
export function parseBoundaryFile(text: string, fileName = ""): ParsedBoundary {
  if (/\.kmz$/i.test(fileName) || text.startsWith("PK")) fail("This is a KMZ, a zipped KML. Unzip it (rename it to .zip and open it) and choose the doc.kml inside.");
  const body = text.replace(/^﻿/, "").trimStart();
  if (body.startsWith("<")) return fromKml(body);
  let doc: unknown;
  try {
    doc = JSON.parse(body);
  } catch {
    fail("The file is neither GeoJSON nor KML. Export the boundary from your GIS tool as GeoJSON (.geojson) or KML (.kml).");
  }
  return fromGeoJson(doc);
}
