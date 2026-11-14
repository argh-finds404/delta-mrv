// WGS84 longitude/latitude to UTM metres (EPSG:326zz north, 327zz south), the grid Sentinel-2
// images are delivered in. The USGS series (Snyder, Map Projections, 1987, p. 61): within a
// zone it agrees with PROJ to well under a metre, against 20 m satellite pixels.

const A = 6378137;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);

/** The zone and hemisphere of a UTM EPSG code, or null for any other code. */
export function utmZoneOf(epsg: number): { zone: number; south: boolean } | null {
  if (epsg >= 32601 && epsg <= 32660) return { zone: epsg - 32600, south: false };
  if (epsg >= 32701 && epsg <= 32760) return { zone: epsg - 32700, south: true };
  return null;
}

/** [easting, northing] in metres in the given zone. */
export function lonLatToUtm(lon: number, lat: number, zone: number, south = false): [number, number] {
  const phi = (lat * Math.PI) / 180;
  const dLam = ((lon - ((zone - 1) * 6 - 180 + 3)) * Math.PI) / 180;
  const [s, c, t] = [Math.sin(phi), Math.cos(phi), Math.tan(phi)];
  const n = A / Math.sqrt(1 - E2 * s * s);
  const tt = t * t;
  const cc = EP2 * c * c;
  const a = c * dLam;
  const m =
    A *
    ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * phi -
      ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * phi));
  const x = K0 * n * (a + ((1 - tt + cc) * a ** 3) / 6 + ((5 - 18 * tt + tt * tt + 72 * cc - 58 * EP2) * a ** 5) / 120) + 500000;
  const y = K0 * (m + n * t * ((a * a) / 2 + ((5 - tt + 9 * cc + 4 * cc * cc) * a ** 4) / 24 + ((61 - 58 * tt + tt * tt + 600 * cc - 330 * EP2) * a ** 6) / 720));
  return [x, south ? y + 10_000_000 : y];
}
