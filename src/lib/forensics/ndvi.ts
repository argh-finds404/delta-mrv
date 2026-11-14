// The vegetation index of one site in one satellite scene: the arithmetic of the X1 cross-check
// (docs/01-FEATURE-LOCK.md), pure so it is tested without a network. NDVI = (NIR - red) /
// (NIR + red) on surface reflectance: about 0.6 to 0.9 over dense vegetation, 0.1 to 0.3 over
// bare soil, below 0 over water. A 20 m pixel says nothing about one plant.

/** Sentinel-2 L2A scene classes counted as a clear view of the ground: vegetation, not vegetated, water. */
export const CLEAR_SCL = new Set([4, 5, 6]);

export type Grid = { x0: number; y0: number; width: number; height: number; data: ArrayLike<number> };
export type Band = { scale: number; offset: number };

/** Even-odd rule; the ring's last point may repeat its first. */
export function pointInRing(x: number, y: number, ring: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Mean NDVI over the pixels whose centres fall inside `ring` (projected metres, the image's own
 * grid), counting only pixels the scene classification calls clear. A site smaller than one
 * pixel is read from the pixel under its centre. The three grids must cover the same pixels.
 */
export function siteNdvi(input: {
  red: Grid;
  nir: Grid;
  scl: Grid;
  /** Top-left corner of the image, and metres per pixel. */
  origin: readonly [number, number];
  pixelSize: number;
  ring: readonly (readonly [number, number])[];
  redBand: Band;
  nirBand: Band;
}): { ndvi: number | null; pixels: number; clear: number } {
  const { red, nir, scl, origin, pixelSize, ring } = input;
  for (const g of [nir, scl]) {
    if (g.x0 !== red.x0 || g.y0 !== red.y0 || g.width !== red.width || g.height !== red.height) throw new Error("the bands do not cover the same pixels");
  }
  const centre = (col: number, row: number): [number, number] => [origin[0] + (red.x0 + col + 0.5) * pixelSize, origin[1] - (red.y0 + row + 0.5) * pixelSize];

  let cells: number[] = [];
  for (let row = 0; row < red.height; row++) {
    for (let col = 0; col < red.width; col++) if (pointInRing(...centre(col, row), ring)) cells.push(row * red.width + col);
  }
  if (!cells.length) {
    const n = ring.length - (ring[0]![0] === ring.at(-1)![0] && ring[0]![1] === ring.at(-1)![1] ? 1 : 0);
    const cx = ring.slice(0, n).reduce((s, p) => s + p[0], 0) / n;
    const cy = ring.slice(0, n).reduce((s, p) => s + p[1], 0) / n;
    const col = Math.floor((cx - origin[0]) / pixelSize) - red.x0;
    const row = Math.floor((origin[1] - cy) / pixelSize) - red.y0;
    if (col >= 0 && row >= 0 && col < red.width && row < red.height) cells = [row * red.width + col];
  }

  let sum = 0;
  let clear = 0;
  for (const i of cells) {
    const [r, n, c] = [red.data[i]!, nir.data[i]!, scl.data[i]!];
    if (!CLEAR_SCL.has(c) || r === 0 || n === 0) continue; // 0 is nodata in both bands
    const rr = r * input.redBand.scale + input.redBand.offset;
    const nn = n * input.nirBand.scale + input.nirBand.offset;
    if (rr < 0 || nn < 0 || rr + nn <= 0) continue; // a negative reflectance is not a measurement
    sum += (nn - rr) / (nn + rr);
    clear++;
  }
  return { ndvi: clear ? sum / clear : null, pixels: cells.length, clear };
}
