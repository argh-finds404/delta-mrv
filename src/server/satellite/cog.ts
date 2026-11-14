import "server-only";
import { inflateSync } from "node:zlib";

// The smallest reader of a Cloud-Optimized GeoTIFF that the satellite cross-check needs: the
// directory of each resolution level, then only the tiles under one site, by HTTP range request.
// Classic little- or big-endian TIFF, tiled, uncompressed or deflate, with or without horizontal
// differencing, 8 or 16 bits, one band: what Sentinel-2 L2A COGs on Earth Search are. Anything
// else is refused by name, never guessed at. No dependency: node's zlib does the inflating.

/** Bytes [start, end] of the file at `url`, end inclusive. */
export type FetchRange = (url: string, start: number, end: number) => Promise<Uint8Array>;

export class UnsupportedCog extends Error {}

export type Ifd = {
  littleEndian: boolean;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  bitsPerSample: 8 | 16;
  compression: 1 | 8;
  predictor: 1 | 2;
  tileOffsets: number[];
  tileByteCounts: number[];
  /** Metres per pixel and the top-left corner, from the full-resolution level's GeoTIFF tags. */
  pixelSize: [number, number] | null;
  origin: [number, number] | null;
};

const HEADER_BYTES = 65536;
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

/** Every resolution level of the file, full resolution first, as the file lists them. */
export async function readCogHeader(url: string, fetchRange: FetchRange): Promise<Ifd[]> {
  let head = await fetchRange(url, 0, HEADER_BYTES - 1);
  const bytesAt = async (offset: number, length: number): Promise<DataView> => {
    if (offset + length > head.length) {
      // a directory or an offsets array past the first read: fetch up to it, once
      const more = await fetchRange(url, head.length, offset + length - 1);
      const joined = new Uint8Array(head.length + more.length);
      joined.set(head);
      joined.set(more, head.length);
      head = joined;
    }
    return new DataView(head.buffer, head.byteOffset + offset, length);
  };

  const order = String.fromCharCode(head[0]!, head[1]!);
  if (order !== "II" && order !== "MM") throw new UnsupportedCog("not a TIFF file");
  const le = order === "II";
  const first = await bytesAt(0, 8);
  const magic = first.getUint16(2, le);
  if (magic === 43) throw new UnsupportedCog("BigTIFF is not supported");
  if (magic !== 42) throw new UnsupportedCog("not a TIFF file");

  const ifds: Ifd[] = [];
  let next = first.getUint32(4, le);
  while (next && ifds.length < 16) {
    const count = (await bytesAt(next, 2)).getUint16(0, le);
    const entries = await bytesAt(next + 2, count * 12 + 4);
    const tags = new Map<number, number[]>();
    for (let i = 0; i < count; i++) {
      const tag = entries.getUint16(i * 12, le);
      const type = entries.getUint16(i * 12 + 2, le);
      const n = entries.getUint32(i * 12 + 4, le);
      const size = TYPE_SIZE[type];
      if (!size) continue;
      const inline = size * n <= 4;
      const view = inline ? new DataView(entries.buffer, entries.byteOffset + i * 12 + 8, 4) : await bytesAt(entries.getUint32(i * 12 + 8, le), size * n);
      const values: number[] = [];
      for (let k = 0; k < n; k++) {
        if (type === 3) values.push(view.getUint16(k * 2, le));
        else if (type === 4) values.push(view.getUint32(k * 4, le));
        else if (type === 12) values.push(view.getFloat64(k * 8, le));
        else if (type === 1 || type === 7) values.push(view.getUint8(k));
      }
      tags.set(tag, values);
    }
    next = entries.getUint32(count * 12, le);

    const one = (tag: number, fallback?: number) => {
      const v = tags.get(tag)?.[0] ?? fallback;
      if (v === undefined) throw new UnsupportedCog(`TIFF tag ${tag} is missing`);
      return v;
    };
    if (!tags.has(322)) throw new UnsupportedCog("the image is not tiled");
    const bits = one(258);
    const compression = one(259, 1);
    const predictor = one(317, 1);
    if (one(277, 1) !== 1) throw new UnsupportedCog("only single-band images are read");
    if (bits !== 8 && bits !== 16) throw new UnsupportedCog(`${bits}-bit samples are not supported`);
    if (compression !== 1 && compression !== 8 && compression !== 32946) throw new UnsupportedCog(`compression ${compression} is not supported`);
    if (predictor !== 1 && predictor !== 2) throw new UnsupportedCog(`predictor ${predictor} is not supported`);
    const scale = tags.get(33550);
    const tie = tags.get(33922);
    ifds.push({
      littleEndian: le,
      width: one(256),
      height: one(257),
      tileWidth: one(322),
      tileHeight: one(323),
      bitsPerSample: bits,
      compression: compression === 1 ? 1 : 8,
      predictor,
      tileOffsets: tags.get(324) ?? [],
      tileByteCounts: tags.get(325) ?? [],
      pixelSize: scale ? [scale[0]!, scale[1]!] : null,
      origin: tie ? [tie[3]! - tie[0]! * (scale?.[0] ?? 0), tie[4]! + tie[1]! * (scale?.[1] ?? 0)] : null,
    });
  }
  if (!ifds.length) throw new UnsupportedCog("the file has no image");
  return ifds;
}

/** Decodes one tile's bytes to samples, undoing the horizontal differencing when there is one. */
export function decodeTile(raw: Uint8Array, ifd: Ifd): Uint16Array | Uint8Array {
  const bytes = ifd.compression === 8 ? inflateSync(raw) : raw;
  const n = ifd.tileWidth * ifd.tileHeight;
  const out = ifd.bitsPerSample === 16 ? new Uint16Array(n) : new Uint8Array(n);
  if (ifd.bitsPerSample === 16) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < n && i * 2 + 1 < bytes.byteLength; i++) out[i] = view.getUint16(i * 2, ifd.littleEndian);
  } else {
    out.set(bytes.subarray(0, n));
  }
  if (ifd.predictor === 2) {
    for (let y = 0; y < ifd.tileHeight; y++) {
      const row = y * ifd.tileWidth;
      for (let x = 1; x < ifd.tileWidth; x++) out[row + x] = out[row + x]! + out[row + x - 1]!; // wraps, as the encoder did
    }
  }
  return out;
}

export type Window = { x0: number; y0: number; width: number; height: number; data: Uint16Array | Uint8Array };

/** The samples of columns [x0, x1) and rows [y0, y1) of one level, reading only the tiles under them. */
export async function readWindow(url: string, ifd: Ifd, x0: number, y0: number, x1: number, y1: number, fetchRange: FetchRange): Promise<Window & { bytesRead: number }> {
  const width = x1 - x0;
  const height = y1 - y0;
  if (width <= 0 || height <= 0 || x0 < 0 || y0 < 0 || x1 > ifd.width || y1 > ifd.height) throw new Error("window outside the image");
  const data = ifd.bitsPerSample === 16 ? new Uint16Array(width * height) : new Uint8Array(width * height);
  const across = Math.ceil(ifd.width / ifd.tileWidth);
  let bytesRead = 0;
  for (let ty = Math.floor(y0 / ifd.tileHeight); ty <= Math.floor((y1 - 1) / ifd.tileHeight); ty++) {
    for (let tx = Math.floor(x0 / ifd.tileWidth); tx <= Math.floor((x1 - 1) / ifd.tileWidth); tx++) {
      const index = ty * across + tx;
      const [offset, length] = [ifd.tileOffsets[index], ifd.tileByteCounts[index]];
      if (offset === undefined || !length) continue; // a sparse tile is all nodata
      const tile = decodeTile(await fetchRange(url, offset, offset + length - 1), ifd);
      bytesRead += length;
      for (let y = Math.max(y0, ty * ifd.tileHeight); y < Math.min(y1, (ty + 1) * ifd.tileHeight); y++) {
        for (let x = Math.max(x0, tx * ifd.tileWidth); x < Math.min(x1, (tx + 1) * ifd.tileWidth); x++) {
          data[(y - y0) * width + (x - x0)] = tile[(y - ty * ifd.tileHeight) * ifd.tileWidth + (x - tx * ifd.tileWidth)]!;
        }
      }
    }
  }
  return { x0, y0, width, height, data, bytesRead };
}
