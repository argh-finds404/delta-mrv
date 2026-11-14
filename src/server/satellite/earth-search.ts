import "server-only";
import { siteNdvi } from "../../lib/forensics/ndvi";
import { lonLatToUtm, utmZoneOf } from "../../lib/geo/utm";
import { readCogHeader, readWindow, UnsupportedCog, type FetchRange, type Ifd } from "./cog";

// The X1 satellite cross-check's reach into the world (docs/01-FEATURE-LOCK.md): the free,
// keyless Earth Search catalogue of Sentinel-2 L2A scenes (Element 84, on AWS open data), and
// range reads of the scenes' band files. What leaves the server: the project's PUBLIC grid-cell
// centre (the search) and the byte ranges of ~10 km tiles (the reads). The exact boundary never
// does: the site's pixels are picked out here, after the tiles arrive.

export const STAC_SEARCH = "https://earth-search.aws.element84.com/v1/search";
/** The only host band files are read from: the catalogue's answer names the URLs, so it is not trusted to name any host. */
export const ARCHIVE_ORIGIN = "https://sentinel-cogs.s3.us-west-2.amazonaws.com";
const COLLECTION = "sentinel-2-l2a";
/** Days before each date that count as "around" it: Sentinel-2 passes every 5 days, clouds permitting. */
export const WINDOW_DAYS = 60;
/** Scenes cloudier than this (whole-scene percentage) are not tried. */
export const MAX_SCENE_CLOUD = 40;
/** A scene is read only if this share of the site's pixels is clear ground. */
export const MIN_CLEAR_SHARE = 0.5;
/** The two scenes must be at least this far apart to say anything about change. */
export const MIN_DAYS_APART = 20;
/** Earlier years read for the same season, so a flood month is compared with flood months. */
export const SEASON_YEARS = 4;
/** Days either side of the current scene's date that count as "the same season" in an earlier year. */
export const SEASON_WINDOW_DAYS = 30;

export type SeasonPoint = { year: number; sceneId: string; datetime: string; ndvi: number };
export type Seasonal = {
  /** One reading per earlier year that had a clear view in the same season, oldest first. */
  years: SeasonPoint[];
  /** The middle of those readings; null with fewer than two years to compare. */
  median: number | null;
  /** Current minus median: how far this season sits from its own usual. */
  anomaly: number | null;
};

export type SceneReading = {
  sceneId: string;
  datetime: string;
  cloudCover: number;
  ndvi: number;
  /** Site pixels (20 m), and how many of them were clear ground. */
  pixels: number;
  clear: number;
};

export type Telemetry = {
  endpoint: string;
  searched: { from: string; to: string; candidates: { id: string; cloudCover: number }[] }[];
  scenes: { id: string; epsg: number | null; level: number | null; window: [number, number, number, number] | null; pixels: number; clear: number; ndvi: number | null; note?: string }[];
  bytesRead: number;
  elapsedMs: number;
};

export type NdviResult =
  | { outcome: "measured"; baseline: SceneReading; current: SceneReading; delta: number; seasonal: Seasonal; telemetry: Telemetry }
  | { outcome: "inconclusive"; reason: string; telemetry: Telemetry };

export type NdviRequest = {
  /** The project's public grid-cell centre: the only position sent to the catalogue. */
  searchPoint: [number, number];
  /** The exact boundary ring, [lon, lat]: used here, never sent. */
  ring: [number, number][];
  baselineEnd: Date;
  currentEnd: Date;
};

type StacItem = {
  id: string;
  properties: {
    datetime: string;
    "eo:cloud_cover"?: number;
    "proj:epsg"?: number;
    "proj:code"?: string;
    "s2:processing_baseline"?: string;
    "earthsearch:boa_offset_applied"?: boolean;
  };
  assets: Record<string, { href: string; "raster:bands"?: { scale?: number; offset?: number }[] }>;
};

export class ArchiveUnavailable extends Error {}

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

/** Fetch with a timeout, and a range read that insists on getting a range. */
export function httpDeps(timeoutMs = 15_000): { fetchJson: (url: string, body: unknown) => Promise<unknown>; fetchRange: FetchRange } {
  return {
    fetchJson: async (url, body) => {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new ArchiveUnavailable(`the catalogue answered ${res.status}`);
      return res.json();
    },
    fetchRange: async (url, start, end) => {
      if (new URL(url).origin !== ARCHIVE_ORIGIN) throw new ArchiveUnavailable("the catalogue named an image outside the Sentinel-2 archive");
      const res = await fetch(url, { headers: { range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(timeoutMs), redirect: "error" });
      // only a partial answer: a 200 would be the whole file, hundreds of megabytes, in memory
      if (res.status !== 206) throw new ArchiveUnavailable(`the image archive answered ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
  };
}

/**
 * Digital number to reflectance. ESA adds 1000 to every value from processing baseline 04.00 on;
 * Earth Search removes it again when it builds the COG and says so with
 * earthsearch:boa_offset_applied (seen in the data: open water reads about 580, which a +1000
 * file could not hold). Applying the offset twice makes dark pixels negative and NDVI nonsense.
 */
function bandScaling(item: StacItem, asset: string) {
  const declared = item.assets[asset]?.["raster:bands"]?.[0];
  if (item.properties["earthsearch:boa_offset_applied"] === true) return { scale: declared?.scale ?? 0.0001, offset: 0 };
  const baseline = item.properties["s2:processing_baseline"] ?? "";
  return { scale: declared?.scale ?? 0.0001, offset: baseline >= "04.00" ? -0.1 : 0 };
}

/** One scene's NDVI over the site, from the 20 m level of the red and near-infrared bands and the scene classification. */
async function readScene(item: StacItem, ring: [number, number][], fetchRange: FetchRange, t: Telemetry): Promise<SceneReading | null> {
  const epsg = item.properties["proj:epsg"] ?? Number(item.properties["proj:code"]?.replace("EPSG:", "") ?? NaN);
  const record: Telemetry["scenes"][number] = { id: item.id, epsg: Number.isFinite(epsg) ? epsg : null, level: null, window: null, pixels: 0, clear: 0, ndvi: null };
  t.scenes.push(record);
  const zone = utmZoneOf(epsg);
  const [red, nir, scl] = [item.assets.red?.href, item.assets.nir?.href, item.assets.scl?.href];
  if (!zone || !red || !nir || !scl) {
    record.note = "not a UTM scene with red, near-infrared and classification bands";
    return null;
  }
  const counted: FetchRange = async (url, s, e) => {
    const bytes = await fetchRange(url, s, e);
    t.bytesRead += bytes.length;
    return bytes;
  };
  const [redIfds, nirIfds, sclIfds] = await Promise.all([readCogHeader(red, counted), readCogHeader(nir, counted), readCogHeader(scl, counted)]);
  const sclFull = sclIfds[0]!;
  const full = redIfds[0]!;
  if (!full.origin || !full.pixelSize || !sclFull.origin) throw new UnsupportedCog("the image carries no georeferencing");
  // the red and near-infrared level on the classification's 20 m grid
  const level = redIfds.findIndex((i) => i.width === sclFull.width && i.height === sclFull.height);
  const pick = (ifds: Ifd[]) => ifds[level];
  if (level < 0 || !pick(nirIfds)) throw new UnsupportedCog("no band level matches the classification grid");
  record.level = level;
  const pixelSize = (full.pixelSize[0] * full.width) / sclFull.width;
  const origin = full.origin;

  const utm = ring.map(([lon, lat]) => lonLatToUtm(lon, lat, zone.zone, zone.south));
  const xs = utm.map((p) => (p[0] - origin[0]) / pixelSize);
  const ys = utm.map((p) => (origin[1] - p[1]) / pixelSize);
  const [x0, y0] = [Math.max(0, Math.floor(Math.min(...xs))), Math.max(0, Math.floor(Math.min(...ys)))];
  const [x1, y1] = [Math.min(sclFull.width, Math.ceil(Math.max(...xs)) + 1), Math.min(sclFull.height, Math.ceil(Math.max(...ys)) + 1)];
  if (x1 <= x0 || y1 <= y0) {
    record.note = "the site is outside this scene's tile";
    return null;
  }
  record.window = [x0, y0, x1, y1];
  const [r, n, c] = await Promise.all([readWindow(red, pick(redIfds)!, x0, y0, x1, y1, counted), readWindow(nir, pick(nirIfds)!, x0, y0, x1, y1, counted), readWindow(scl, sclFull, x0, y0, x1, y1, counted)]);
  const out = siteNdvi({ red: r, nir: n, scl: c, origin, pixelSize, ring: utm, redBand: bandScaling(item, "red"), nirBand: bandScaling(item, "nir") });
  Object.assign(record, { pixels: out.pixels, clear: out.clear, ndvi: out.ndvi });
  if (out.ndvi === null || out.clear / Math.max(1, out.pixels) < MIN_CLEAR_SHARE) {
    record.note = `${out.clear} of ${out.pixels} site pixels were clear ground`;
    return null;
  }
  return { sceneId: item.id, datetime: item.properties.datetime, cloudCover: item.properties["eo:cloud_cover"] ?? 0, ndvi: out.ndvi, pixels: out.pixels, clear: out.clear };
}

/** The clearest readable scene in the WINDOW_DAYS before `end`. */
const bestScene = (req: NdviRequest, end: Date, deps: ReturnType<typeof httpDeps>, t: Telemetry) => bestSceneBetween(req, new Date(end.getTime() - WINDOW_DAYS * DAY), end, deps, t);

/** The clearest readable scene dated within [from, end]: at most three are tried, least cloudy first. */
async function bestSceneBetween(req: NdviRequest, from: Date, end: Date, deps: ReturnType<typeof httpDeps>, t: Telemetry): Promise<SceneReading | null> {
  const [lon, lat] = req.searchPoint;
  const body = {
    collections: [COLLECTION],
    intersects: { type: "Point", coordinates: [lon, lat] },
    datetime: `${iso(from)}/${iso(end)}`,
    query: { "eo:cloud_cover": { lt: MAX_SCENE_CLOUD } },
    sortby: [{ field: "properties.eo:cloud_cover", direction: "asc" }],
    limit: 6,
  };
  const page = (await deps.fetchJson(STAC_SEARCH, body)) as { features?: StacItem[] };
  // the catalogue's word on dates is checked too: a scene outside the window says nothing about it
  const items = (page.features ?? []).filter((i) => {
    const at = Date.parse(i.properties.datetime);
    return at >= from.getTime() && at <= end.getTime();
  });
  t.searched.push({ from: iso(from), to: iso(end), candidates: items.map((i) => ({ id: i.id, cloudCover: i.properties["eo:cloud_cover"] ?? 0 })) });
  for (const item of items.slice(0, 3)) {
    const reading = await readScene(item, req.ring, deps.fetchRange, t);
    if (reading) return reading;
  }
  return null;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/**
 * The same season in each of the `years` before the current scene: the clearest view within
 * SEASON_WINDOW_DAYS of the same date, read in parallel. A year with no clear view, or one the
 * archive fails on, is simply missing: the history is context, and never makes the check fail.
 */
async function seasonalHistory(req: NdviRequest, current: SceneReading, deps: ReturnType<typeof httpDeps>, t: Telemetry, years: number): Promise<Seasonal> {
  const at = new Date(current.datetime);
  const readings = await Promise.all(
    Array.from({ length: years }, async (_, i) => {
      const centre = new Date(at);
      centre.setUTCFullYear(at.getUTCFullYear() - (i + 1));
      try {
        const r = await bestSceneBetween(req, new Date(centre.getTime() - SEASON_WINDOW_DAYS * DAY), new Date(centre.getTime() + SEASON_WINDOW_DAYS * DAY), deps, t);
        return r ? { year: centre.getUTCFullYear(), sceneId: r.sceneId, datetime: r.datetime, ndvi: r.ndvi } : null;
      } catch {
        return null;
      }
    }),
  );
  const found = readings.filter((r): r is SeasonPoint => r !== null).sort((a, b) => a.year - b.year);
  const mid = found.length >= 2 ? median(found.map((r) => r.ndvi)) : null;
  return { years: found, median: mid, anomaly: mid === null ? null : current.ndvi - mid };
}

/**
 * NDVI over the site around the two dates, the change between them, and the current scene against
 * the same season in earlier years. Every failure that is the world's, not the code's (no clear
 * scene, the archive slow or refusing, an image it cannot read), is an `inconclusive` result with
 * a reason, never an exception: the check is advisory.
 */
export async function crossCheckNdvi(req: NdviRequest, deps: ReturnType<typeof httpDeps> = httpDeps(), opts: { seasonYears?: number } = {}): Promise<NdviResult> {
  const started = Date.now();
  const t: Telemetry = { endpoint: STAC_SEARCH, searched: [], scenes: [], bytesRead: 0, elapsedMs: 0 };
  const done = <R extends NdviResult>(r: R): R => {
    t.elapsedMs = Date.now() - started;
    return r;
  };
  try {
    const baseline = await bestScene(req, req.baselineEnd, deps, t);
    if (!baseline) return done({ outcome: "inconclusive", reason: `no clear satellite view of the site in the ${WINDOW_DAYS} days before ${iso(req.baselineEnd).slice(0, 10)}`, telemetry: t });
    const current = await bestScene(req, req.currentEnd, deps, t);
    if (!current) return done({ outcome: "inconclusive", reason: `no clear satellite view of the site in the ${WINDOW_DAYS} days before ${iso(req.currentEnd).slice(0, 10)}`, telemetry: t });
    if (Math.abs(Date.parse(current.datetime) - Date.parse(baseline.datetime)) < MIN_DAYS_APART * DAY) {
      return done({ outcome: "inconclusive", reason: `the two clearest views are less than ${MIN_DAYS_APART} days apart, too close to show change`, telemetry: t });
    }
    const seasonal = await seasonalHistory(req, current, deps, t, opts.seasonYears ?? SEASON_YEARS);
    return done({ outcome: "measured", baseline, current, delta: current.ndvi - baseline.ndvi, seasonal, telemetry: t });
  } catch (e) {
    if (e instanceof ArchiveUnavailable || e instanceof UnsupportedCog) return done({ outcome: "inconclusive", reason: e.message, telemetry: t });
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError" || e.name === "TypeError")) {
      // a timeout, or fetch failing to connect at all
      return done({ outcome: "inconclusive", reason: "the satellite archive did not answer in time", telemetry: t });
    }
    throw e;
  }
}

