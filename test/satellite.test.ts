// X1, the satellite cross-check, without a network: the projection, the COG reader on files
// written in the same layout as Sentinel-2's, the NDVI arithmetic, and the whole check against a
// fake archive, including every way it ends "inconclusive" instead of failing.
import { describe, expect, it, vi } from "vitest";
import { pointInRing, siteNdvi } from "../src/lib/forensics/ndvi";
import { lonLatToUtm, utmZoneOf } from "../src/lib/geo/utm";
import { readCogHeader, readWindow, UnsupportedCog } from "../src/server/satellite/cog";
import { ArchiveUnavailable, crossCheckNdvi, httpDeps, STAC_SEARCH } from "../src/server/satellite/earth-search";
import { makeCog, memoryArchive } from "./support/make-cog";

describe("UTM", () => {
  it("puts the central meridian at 500 km east and the equator at 0 north", () => {
    expect(lonLatToUtm(87, 0, 45)).toEqual([500000, 0]);
    expect(lonLatToUtm(87, -1, 45, true)[1]).toBeCloseTo(10_000_000 - 110_579, -2);
  });

  it("agrees within 2 m with the corner of real Sentinel-2 tile 45QYE (EPSG:32645, top-left 699960, 2500020)", () => {
    // the scene footprint's north-west vertex, as Earth Search publishes it in longitude and latitude
    const [e, n] = lonLatToUtm(88.94517341660162, 22.595243735184674, 45);
    expect(Math.hypot(e - 699960, n - 2500020)).toBeLessThan(2);
  });

  it("reads zone and hemisphere from the EPSG code, and nothing else", () => {
    expect(utmZoneOf(32645)).toEqual({ zone: 45, south: false });
    expect(utmZoneOf(32733)).toEqual({ zone: 33, south: true });
    expect(utmZoneOf(4326)).toBeNull();
  });
});

describe("the COG reader", () => {
  const values = Array.from({ length: 40 * 40 }, (_, i) => (i * 37) % 65000);
  const file = makeCog(
    [
      { width: 40, height: 40, tile: 16, bits: 16, data: values },
      { width: 20, height: 20, tile: 16, bits: 16, data: values.filter((_, i) => i % 2 === 0 && Math.floor(i / 40) % 2 === 0) },
    ],
    { pixel: 10, origin: [699960, 2500020] },
  );
  const archive = memoryArchive({ "mem://b04.tif": file });

  it("reads every level, its tiling and georeferencing", async () => {
    const [full, over] = await readCogHeader("mem://b04.tif", archive.fetchRange);
    expect(full).toMatchObject({ width: 40, height: 40, tileWidth: 16, bitsPerSample: 16, compression: 8, predictor: 2, pixelSize: [10, 10], origin: [699960, 2500020] });
    expect(full!.tileOffsets).toHaveLength(9);
    expect(over).toMatchObject({ width: 20, height: 20, pixelSize: null });
  });

  it("returns exactly the samples of a window that crosses tile edges, undoing the differencing", async () => {
    const [full] = await readCogHeader("mem://b04.tif", archive.fetchRange);
    const w = await readWindow("mem://b04.tif", full!, 10, 14, 22, 19, archive.fetchRange);
    const expected: number[] = [];
    for (let y = 14; y < 19; y++) for (let x = 10; x < 22; x++) expected.push(values[y * 40 + x]!);
    expect([...w.data]).toEqual(expected);
  });

  it("refuses what it cannot read by name, never by guessing", async () => {
    const big = new Uint8Array(16);
    big.set([0x49, 0x49, 43, 0]);
    await expect(readCogHeader("mem://big.tif", memoryArchive({ "mem://big.tif": big }).fetchRange)).rejects.toThrow(UnsupportedCog);
    await expect(readCogHeader("mem://png", memoryArchive({ "mem://png": new Uint8Array([0x89, 0x50, 0x4e, 0x47]) }).fetchRange)).rejects.toThrow(/not a TIFF/);
  });
});

describe("site NDVI", () => {
  const grid = (data: number[]) => ({ x0: 0, y0: 0, width: 3, height: 1, data });
  const ring: [number, number][] = [[0, 0], [60, 0], [60, -20], [0, -20], [0, 0]];
  const base = { origin: [0, 0] as const, pixelSize: 20, ring, redBand: { scale: 0.0001, offset: 0 }, nirBand: { scale: 0.0001, offset: 0 } };

  it("averages clear pixels inside the boundary and skips cloud, nodata and impossible values", () => {
    const out = siteNdvi({ ...base, red: grid([500, 500, 0]), nir: grid([3000, 3000, 3000]), scl: grid([4, 9, 4]) });
    expect(out).toMatchObject({ pixels: 3, clear: 1 });
    expect(out.ndvi).toBeCloseTo((0.3 - 0.05) / 0.35);
    // with an offset that pushes reflectance below zero, the pixel is not a measurement
    expect(siteNdvi({ ...base, redBand: { scale: 0.0001, offset: -0.1 }, red: grid([500, 500, 500]), nir: grid([3000, 3000, 3000]), scl: grid([4, 4, 4]) })).toMatchObject({ clear: 0, ndvi: null });
  });

  it("reads a site smaller than one pixel from the pixel under its centre", () => {
    const tiny: [number, number][] = [[25, -5], [30, -5], [30, -10], [25, -10], [25, -5]];
    const out = siteNdvi({ ...base, ring: tiny, red: grid([1, 1000, 1]), nir: grid([1, 3000, 1]), scl: grid([4, 4, 4]) });
    expect(out).toMatchObject({ pixels: 1, clear: 1 });
    expect(out.ndvi).toBeCloseTo(0.5, 12);
  });

  it("knows inside from outside", () => {
    expect(pointInRing(30, -10, ring)).toBe(true);
    expect(pointInRing(70, -10, ring)).toBe(false);
  });
});

describe("crossCheckNdvi against a fake archive", () => {
  // a ring ~100 to 350 m inside the top-left corner of tile 45QYE
  const ring: [number, number][] = [[88.946, 22.594], [88.9485, 22.594], [88.9485, 22.592], [88.946, 22.592], [88.946, 22.594]];
  const scene = (id: string, datetime: string, red: number, nir: number) => {
    const full = (v: number) => Array.from({ length: 40 * 40 }, () => v);
    const half = (v: number) => Array.from({ length: 20 * 20 }, () => v);
    const geo = { pixel: 10, origin: [699960, 2500020] as [number, number] };
    const files = {
      [`mem://${id}/B04.tif`]: makeCog([{ width: 40, height: 40, tile: 16, bits: 16, data: full(red) }, { width: 20, height: 20, tile: 16, bits: 16, data: half(red) }], geo),
      [`mem://${id}/B08.tif`]: makeCog([{ width: 40, height: 40, tile: 16, bits: 16, data: full(nir) }, { width: 20, height: 20, tile: 16, bits: 16, data: half(nir) }], geo),
      [`mem://${id}/SCL.tif`]: makeCog([{ width: 20, height: 20, tile: 16, bits: 8, data: half(4) }], { pixel: 20, origin: geo.origin }),
    };
    const item = {
      id,
      properties: { datetime, "eo:cloud_cover": 1.5, "proj:epsg": 32645, "earthsearch:boa_offset_applied": true },
      assets: { red: { href: `mem://${id}/B04.tif` }, nir: { href: `mem://${id}/B08.tif` }, scl: { href: `mem://${id}/SCL.tif` } },
    };
    return { files, item };
  };
  const before = scene("S2_BEFORE", "2026-01-20T04:50:00Z", 500, 3000);
  const after = scene("S2_AFTER", "2026-10-20T04:50:00Z", 1000, 1500);
  const archive = memoryArchive({ ...before.files, ...after.files });
  const request = { searchPoint: [88.95, 22.59] as [number, number], ring, baselineEnd: new Date("2026-02-01T00:00:00Z"), currentEnd: new Date("2026-11-01T00:00:00Z") };

  it("measures the site in the clearest scene of each window and reports the change", async () => {
    const searches: unknown[] = [];
    const fetchJson = async (url: string, body: unknown) => {
      expect(url).toBe(STAC_SEARCH);
      searches.push(body);
      const to = (body as { datetime: string }).datetime.split("/")[1]!;
      return { features: [to.startsWith("2026-02") ? before.item : after.item] };
    };
    const r = await crossCheckNdvi(request, { fetchJson, fetchRange: archive.fetchRange });
    expect(r.outcome).toBe("measured");
    if (r.outcome !== "measured") return;
    expect(r.baseline).toMatchObject({ sceneId: "S2_BEFORE", cloudCover: 1.5 });
    expect(r.baseline.ndvi).toBeCloseTo((0.3 - 0.05) / 0.35, 6);
    expect(r.current.ndvi).toBeCloseTo((0.15 - 0.1) / 0.25, 6);
    expect(r.delta).toBeCloseTo(r.current.ndvi - r.baseline.ndvi, 9);
    expect(r.baseline.clear).toBe(r.baseline.pixels);
    expect(r.baseline.pixels).toBeGreaterThan(50);
    // the catalogue is asked about the public point only, never the boundary
    expect(JSON.stringify(searches)).not.toContain("88.946");
    expect(searches[0]).toMatchObject({ intersects: { type: "Point", coordinates: [88.95, 22.59] } });
    expect(r.telemetry.bytesRead).toBeGreaterThan(0);
  });

  it("is inconclusive, never an error, when the two clearest scenes are too close in time", async () => {
    const r = await crossCheckNdvi(request, { fetchJson: async () => ({ features: [after.item] }), fetchRange: archive.fetchRange });
    expect(r).toMatchObject({ outcome: "inconclusive", reason: expect.stringMatching(/too close/) });
  });

  it("is inconclusive when no scene is found, or the archive refuses or times out", async () => {
    expect(await crossCheckNdvi(request, { fetchJson: async () => ({ features: [] }), fetchRange: archive.fetchRange })).toMatchObject({ outcome: "inconclusive", reason: expect.stringMatching(/no clear satellite view/) });
    const refused = async () => {
      throw new ArchiveUnavailable("the catalogue answered 429");
    };
    expect(await crossCheckNdvi(request, { fetchJson: refused, fetchRange: archive.fetchRange })).toMatchObject({ outcome: "inconclusive", reason: "the catalogue answered 429" });
    const slow = async () => {
      throw Object.assign(new Error("aborted"), { name: "TimeoutError" });
    };
    expect(await crossCheckNdvi(request, { fetchJson: slow, fetchRange: archive.fetchRange })).toMatchObject({ outcome: "inconclusive", reason: "the satellite archive did not answer in time" });
  });

  it("reads band files only from the Sentinel-2 archive, whatever URL the catalogue names", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      for (const url of ["http://169.254.169.254/latest/meta-data/", "https://sentinel-cogs.s3.us-west-2.amazonaws.com.evil.example/B04.tif", "http://sentinel-cogs.s3.us-west-2.amazonaws.com/B04.tif"]) {
        await expect(httpDeps().fetchRange(url, 0, 10)).rejects.toThrow(ArchiveUnavailable);
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
