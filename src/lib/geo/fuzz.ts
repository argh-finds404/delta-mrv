// Coordinate fuzzing (docs/13-FEATURE-SPEC.md D5). The public sees the centre of a
// grid cell, never the centroid. Deterministic on purpose: a random offset would
// differ per request and could be averaged away by repeated queries (THREAT_MODEL T5).
//
// Granularity is the documented parameter: 1/20 degree, about 5.5 km at the equator.
export const FUZZ_CELLS_PER_DEGREE = 20;

export type LonLat = [number, number];

/** Area-weighted planar centroid of a closed ring; vertex mean if the ring has no area. */
export function polygonCentroid(ring: LonLat[]): LonLat {
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i]!;
    const [x1, y1] = ring[i + 1]!;
    const cross = x0 * y1 - x1 * y0;
    area2 += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(area2) < 1e-12) {
    const pts = ring.slice(0, -1);
    return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  }
  return [cx / (3 * area2), cy / (3 * area2)];
}

const cellCentre = (v: number) => Number(((Math.floor(v * FUZZ_CELLS_PER_DEGREE) + 0.5) / FUZZ_CELLS_PER_DEGREE).toFixed(6));

export function fuzzCentroid([lon, lat]: LonLat): LonLat {
  return [cellCentre(lon), cellCentre(lat)];
}
