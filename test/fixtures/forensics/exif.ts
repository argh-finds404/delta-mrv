// Writes a minimal EXIF block (APP1, little-endian TIFF) into a JPEG, so the forensics tests
// control exactly which tags exist: a camera, a capture time, a GPS fix. No dependency: the
// layout is the TIFF 6.0 / EXIF 2.3 one, small enough to read in one sitting.

type Entry = { tag: number; type: 1 | 2 | 4 | 5; count: number; data: Buffer };

const ascii = (tag: number, s: string): Entry => ({ tag, type: 2, count: s.length + 1, data: Buffer.from(`${s}\0`, "latin1") });
const long = (tag: number, v: number): Entry => {
  const data = Buffer.alloc(4);
  data.writeUInt32LE(v);
  return { tag, type: 4, count: 1, data };
};
const rationals = (tag: number, parts: [number, number][]): Entry => {
  const data = Buffer.alloc(8 * parts.length);
  parts.forEach(([n, d], i) => {
    data.writeUInt32LE(n, 8 * i);
    data.writeUInt32LE(d, 8 * i + 4);
  });
  return { tag, type: 5, count: parts.length, data };
};
const dms = (deg: number): [number, number][] => {
  const a = Math.abs(deg);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = Math.round(((a - d) * 60 - m) * 60 * 1000);
  return [[d, 1], [m, 1], [s, 1000]];
};

const external = (e: Entry) => (e.data.length > 4 ? e.data.length + (e.data.length % 2) : 0);
const ifdSize = (entries: Entry[]) => 2 + 12 * entries.length + 4 + entries.reduce((n, e) => n + external(e), 0);

function writeIfd(buf: Buffer, at: number, entries: Entry[]) {
  const sorted = [...entries].sort((a, b) => a.tag - b.tag);
  buf.writeUInt16LE(sorted.length, at);
  let data = at + 2 + 12 * sorted.length + 4;
  sorted.forEach((e, i) => {
    const p = at + 2 + 12 * i;
    buf.writeUInt16LE(e.tag, p);
    buf.writeUInt16LE(e.type, p + 2);
    buf.writeUInt32LE(e.count, p + 4);
    if (e.data.length <= 4) e.data.copy(buf, p + 8);
    else {
      buf.writeUInt32LE(data, p + 8);
      e.data.copy(buf, data);
      data += external(e);
    }
  });
  buf.writeUInt32LE(0, at + 2 + 12 * sorted.length); // no next IFD
}

export type ExifTags = { make?: string; dateTimeOriginal?: string; offsetTimeOriginal?: string; gps?: { lat: number; lon: number } };

/** `jpeg` with an EXIF block holding exactly `tags`. `dateTimeOriginal` is "YYYY:MM:DD HH:MM:SS". */
export function withExif(jpeg: Buffer, tags: ExifTags): Buffer {
  const exif: Entry[] = [];
  if (tags.dateTimeOriginal) exif.push(ascii(0x9003, tags.dateTimeOriginal));
  if (tags.offsetTimeOriginal) exif.push(ascii(0x9011, tags.offsetTimeOriginal));
  const gps: Entry[] = tags.gps
    ? [
        { tag: 0x0000, type: 1, count: 4, data: Buffer.from([2, 3, 0, 0]) },
        ascii(0x0001, tags.gps.lat >= 0 ? "N" : "S"),
        rationals(0x0002, dms(tags.gps.lat)),
        ascii(0x0003, tags.gps.lon >= 0 ? "E" : "W"),
        rationals(0x0004, dms(tags.gps.lon)),
      ]
    : [];

  // offsets are from the start of the TIFF header; pointer values are fixed-size, so the
  // sizes are known before the values
  const ifd0: Entry[] = [];
  if (tags.make) ifd0.push(ascii(0x010f, tags.make));
  if (exif.length) ifd0.push(long(0x8769, 0));
  if (gps.length) ifd0.push(long(0x8825, 0));
  const exifAt = 8 + ifdSize(ifd0);
  const gpsAt = exifAt + (exif.length ? ifdSize(exif) : 0);
  for (const e of ifd0) {
    if (e.tag === 0x8769) e.data.writeUInt32LE(exifAt);
    if (e.tag === 0x8825) e.data.writeUInt32LE(gpsAt);
  }

  const tiff = Buffer.alloc(gpsAt + (gps.length ? ifdSize(gps) : 0));
  tiff.write("II", 0, "latin1");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  writeIfd(tiff, 8, ifd0);
  if (exif.length) writeIfd(tiff, exifAt, exif);
  if (gps.length) writeIfd(tiff, gpsAt, gps);

  const body = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const app1 = Buffer.alloc(4);
  app1.writeUInt16BE(0xffe1, 0);
  app1.writeUInt16BE(body.length + 2, 2);
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error("withExif needs a JPEG");
  return Buffer.concat([jpeg.subarray(0, 2), app1, body, jpeg.subarray(2)]);
}
