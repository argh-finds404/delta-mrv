// Area and perimeter of a site boundary on the sphere, for the browser's hints and the claim check's
// arithmetic, and whether a ring crosses itself. [lon, lat] degrees; the ring may be open or closed.
// The server's own area comes from PostGIS on the spheroid; these agree to well under one percent.

const R_AREA = 6_378_137; // the WGS 84 equatorial radius, as geojson-area and most GIS tools use for this formula
const R_MEAN = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

type Pt = readonly [number, number];
const open = (ring: readonly Pt[]) => (ring.length > 1 && ring[0]![0] === ring.at(-1)![0] && ring[0]![1] === ring.at(-1)![1] ? ring.slice(0, -1) : ring);

/** Square metres enclosed, whichever way the ring turns (Chamberlain and Duquette's spherical formula). */
export function ringAreaM2(ring: readonly Pt[]): number {
  const p = open(ring);
  const n = p.length;
  if (n < 3) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const [a, b, c] = [p[i]!, p[(i + 1) % n]!, p[(i + 2) % n]!];
    total += (rad(c[0]) - rad(a[0])) * Math.sin(rad(b[1]));
  }
  return Math.abs((total * R_AREA * R_AREA) / 2);
}

/** Metres around the ring, great-circle distance between consecutive corners. */
export function ringPerimeterM(ring: readonly Pt[]): number {
  const p = open(ring);
  let total = 0;
  for (let i = 0; i < p.length; i++) {
    const [a, b] = [p[i]!, p[(i + 1) % p.length]!];
    const h = Math.sin(rad(b[1] - a[1]) / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2;
    total += 2 * R_MEAN * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return total;
}

const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const between = (a: number, b: number, c: number) => Math.min(a, b) <= c && c <= Math.max(a, b);
function segmentsMeet(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const [d1, d2, d3, d4] = [cross(p3, p4, p1), cross(p3, p4, p2), cross(p1, p2, p3), cross(p1, p2, p4)];
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  // touching or overlapping collinear edges count as crossing: PostGIS would call the ring invalid too
  return (d1 === 0 && between(p3[0], p4[0], p1[0]) && between(p3[1], p4[1], p1[1])) || (d2 === 0 && between(p3[0], p4[0], p2[0]) && between(p3[1], p4[1], p2[1]));
}

/**
 * The first pair of edges that cross, as the 1-based numbers of the corners they start from, or
 * null. Edges sharing a corner are not compared. Planar in degrees: right for a site, not a continent.
 */
export function selfIntersection(ring: readonly Pt[]): [number, number] | null {
  const p = open(ring);
  const n = p.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // the closing edge shares corner 1
      if (segmentsMeet(p[i]!, p[(i + 1) % n]!, p[j]!, p[(j + 1) % n]!)) return [i + 1, j + 1];
    }
  }
  return null;
}

/** "4.2 ha", "0.38 ha", "1,240 ha": hectares as a person reads them. */
export function formatHectares(m2: number): string {
  const ha = m2 / 10_000;
  const digits = ha >= 100 ? 0 : ha >= 10 ? 1 : 2;
  return `${ha.toLocaleString("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: 0 })} ha`;
}
