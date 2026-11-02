import { describe, expect, it } from "vitest";
import { FUZZ_CELLS_PER_DEGREE, fuzzCentroid, polygonCentroid } from "../src/lib/geo/fuzz";

const ring = (pts: [number, number][]) => [...pts, pts[0]!];

describe("polygonCentroid", () => {
  it("finds the centre of a square", () => {
    const sq = ring([[10, 20], [12, 20], [12, 22], [10, 22]]);
    expect(polygonCentroid(sq)).toEqual([11, 21]);
  });

  it("is area-weighted, not a vertex mean", () => {
    // Right triangle: centroid is the mean of the three corners, (2, 1)
    const tri = ring([[0, 0], [6, 0], [0, 3]]);
    const [x, y] = polygonCentroid(tri);
    expect(x).toBeCloseTo(2, 10);
    expect(y).toBeCloseTo(1, 10);
  });

  it("does not depend on winding direction", () => {
    const cw = ring([[10, 20], [10, 22], [12, 22], [12, 20]]);
    expect(polygonCentroid(cw)).toEqual([11, 21]);
  });

  it("falls back to the vertex mean for a degenerate ring instead of NaN", () => {
    const line = ring([[0, 0], [2, 2], [4, 4]]);
    const [x, y] = polygonCentroid(line);
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
  });
});

describe("fuzzCentroid", () => {
  const step = 1 / FUZZ_CELLS_PER_DEGREE;

  it("returns the centre of the grid cell containing the point", () => {
    const [lon, lat] = fuzzCentroid([89.3123, 22.3456]);
    expect(lon).toBeCloseTo(89.325, 9); // cell [89.30, 89.35)
    expect(lat).toBeCloseTo(22.325, 9); //  cell [22.30, 22.35)
  });

  it("is deterministic and identical for every point in the same cell", () => {
    const a = fuzzCentroid([89.301, 22.301]);
    expect(fuzzCentroid([89.349, 22.349])).toEqual(a);
    expect(fuzzCentroid([89.301, 22.301])).toEqual(a);
  });

  it("never lands more than half a cell from the real point, and is rarely the point itself", () => {
    const p: [number, number] = [90.4071, 23.8123];
    const [lon, lat] = fuzzCentroid(p);
    expect(Math.abs(lon - p[0])).toBeLessThanOrEqual(step / 2 + 1e-9);
    expect(Math.abs(lat - p[1])).toBeLessThanOrEqual(step / 2 + 1e-9);
    expect([lon, lat]).not.toEqual(p);
  });

  it("works on negative coordinates", () => {
    const [lon, lat] = fuzzCentroid([-0.01, -0.01]);
    expect(lon).toBeCloseTo(-0.025, 9);
    expect(lat).toBeCloseTo(-0.025, 9);
  });
});
