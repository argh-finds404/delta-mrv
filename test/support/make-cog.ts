// Writes a small tiled GeoTIFF the way Sentinel-2 COGs are written (little-endian, deflate,
// horizontal differencing), so the reader in src/server/satellite/cog.ts is tested without a
// network. Level 0 carries the georeferencing; later levels are overviews.
import { deflateSync } from "node:zlib";

export type Level = { width: number; height: number; tile: number; bits: 8 | 16; data: ArrayLike<number>; predictor?: 1 | 2 };

function encodeTile(l: Level, tx: number, ty: number): Buffer {
  const s = l.bits === 16 ? new Uint16Array(l.tile * l.tile) : new Uint8Array(l.tile * l.tile);
  for (let y = 0; y < l.tile; y++) {
    for (let x = 0; x < l.tile; x++) {
      const [gx, gy] = [tx * l.tile + x, ty * l.tile + y];
      s[y * l.tile + x] = gx < l.width && gy < l.height ? l.data[gy * l.width + gx]! : 0;
    }
  }
  if ((l.predictor ?? 2) === 2) {
    for (let y = 0; y < l.tile; y++) for (let x = l.tile - 1; x > 0; x--) s[y * l.tile + x] = s[y * l.tile + x]! - s[y * l.tile + x - 1]!;
  }
  return deflateSync(Buffer.from(s.buffer, s.byteOffset, s.byteLength));
}

export function makeCog(levels: Level[], geo?: { pixel: number; origin: [number, number] }): Uint8Array {
  const tiles = levels.map((l) => {
    const out: Buffer[] = [];
    for (let ty = 0; ty < Math.ceil(l.height / l.tile); ty++) for (let tx = 0; tx < Math.ceil(l.width / l.tile); tx++) out.push(encodeTile(l, tx, ty));
    return out;
  });
  // entries per level: 10 always, plus scale and tiepoint on level 0
  const entries = levels.map((_, i) => (i === 0 && geo ? 12 : 10));
  const extras = levels.map((_, i) => {
    const n = tiles[i]!.length;
    return (n > 1 ? 8 * n : 0) + (i === 0 && geo ? 24 + 48 : 0);
  });
  const headerSize = 8 + levels.reduce((sum, _, i) => sum + 2 + 12 * entries[i]! + 4 + extras[i]!, 0);
  const total = headerSize + tiles.flat().reduce((n, t) => n + t.length, 0);
  const buf = new ArrayBuffer(total);
  const v = new DataView(buf);
  const bytes = new Uint8Array(buf);
  bytes.set([0x49, 0x49]);
  v.setUint16(2, 42, true);
  v.setUint32(4, 8, true);

  let tileAt = headerSize;
  let pos = 8;
  levels.forEach((l, i) => {
    const ifd = pos;
    const n = entries[i]!;
    let extra = ifd + 2 + 12 * n + 4;
    const offsets = tiles[i]!.map((t) => {
      bytes.set(t, tileAt);
      const at = tileAt;
      tileAt += t.length;
      return at;
    });
    const counts = tiles[i]!.map((t) => t.length);
    v.setUint16(ifd, n, true);
    let e = ifd + 2;
    const entry = (tag: number, type: number, count: number, write: (at: number) => void) => {
      v.setUint16(e, tag, true);
      v.setUint16(e + 2, type, true);
      v.setUint32(e + 4, count, true);
      write(e + 8);
      e += 12;
    };
    const long = (tag: number, value: number) => entry(tag, 4, 1, (at) => v.setUint32(at, value, true));
    const short = (tag: number, value: number) => entry(tag, 3, 1, (at) => v.setUint16(at, value, true));
    const longs = (tag: number, values: number[]) =>
      entry(tag, 4, values.length, (at) => {
        if (values.length === 1) return v.setUint32(at, values[0]!, true);
        v.setUint32(at, extra, true);
        values.forEach((x, k) => v.setUint32(extra + 4 * k, x, true));
        extra += 4 * values.length;
      });
    const doubles = (tag: number, values: number[]) =>
      entry(tag, 12, values.length, (at) => {
        v.setUint32(at, extra, true);
        values.forEach((x, k) => v.setFloat64(extra + 8 * k, x, true));
        extra += 8 * values.length;
      });
    long(256, l.width);
    long(257, l.height);
    short(258, l.bits);
    short(259, 8);
    short(277, 1);
    short(317, l.predictor ?? 2);
    short(322, l.tile);
    short(323, l.tile);
    longs(324, offsets);
    longs(325, counts);
    if (i === 0 && geo) {
      doubles(33550, [geo.pixel, geo.pixel, 0]);
      doubles(33922, [0, 0, 0, geo.origin[0], geo.origin[1], 0]);
    }
    pos = extra;
    v.setUint32(ifd + 2 + 12 * n, i < levels.length - 1 ? pos : 0, true);
  });
  return bytes;
}

/** A FetchRange over in-memory files, counting the requests. */
export function memoryArchive(files: Record<string, Uint8Array>) {
  const calls: string[] = [];
  return {
    calls,
    fetchRange: async (url: string, start: number, end: number) => {
      calls.push(`${url}#${start}-${end}`);
      const file = files[url];
      if (!file) throw new Error(`no such file ${url}`);
      return file.slice(start, Math.min(end + 1, file.length));
    },
  };
}
