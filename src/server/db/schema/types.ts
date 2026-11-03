import { customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// No `server-only` here: drizzle-kit loads this folder outside Next.

/** GeoJSON, [longitude, latitude] order everywhere. */
export type GeoPoint = { type: "Point"; coordinates: [number, number] };
export type GeoPolygon = { type: "Polygon"; coordinates: [number, number][][] };

function assertLonLat([lon, lat]: [number, number]) {
  // A swapped pair fails here: latitude cannot exceed 90.
  if (!(Math.abs(lon) <= 180 && Math.abs(lat) <= 90)) {
    throw new Error(`coordinate out of range, expected [longitude, latitude]: [${lon}, ${lat}]`);
  }
}

/**
 * EWKB hex, as postgres.js returns a geography column, to GeoJSON.
 * Ported from docs/salvage/geometry-point-type.ts.txt (endianness and SRID-flag
 * handling), extended to Polygon. The salvage returned [0, 0] on anything it
 * could not parse; this throws, because a coordinate must never be invented.
 */
export function parseEwkb(hex: string): GeoPoint | GeoPolygon {
  const buf = Buffer.from(hex, "hex");
  const le = buf.readUInt8(0) === 1;
  let off = 1;
  const u32 = () => {
    const v = le ? buf.readUInt32LE(off) : buf.readUInt32BE(off);
    off += 4;
    return v;
  };
  const f64 = () => {
    const v = le ? buf.readDoubleLE(off) : buf.readDoubleBE(off);
    off += 8;
    return v;
  };
  const pt = (): [number, number] => [f64(), f64()];

  const flags = u32();
  if (flags & 0xc0000000) throw new Error("EWKB with Z or M ordinates is not supported");
  if (flags & 0x20000000) off += 4; // skip SRID
  const kind = flags & 0xff;

  if (kind === 1) return { type: "Point", coordinates: pt() };
  if (kind === 3) {
    const rings: [number, number][][] = [];
    for (let r = u32(); r > 0; r--) {
      const ring: [number, number][] = [];
      for (let n = u32(); n > 0; n--) ring.push(pt());
      rings.push(ring);
    }
    return { type: "Polygon", coordinates: rings };
  }
  throw new Error(`unsupported EWKB geometry type ${kind}`);
}

const fromGeography = <T extends GeoPoint | GeoPolygon>(type: T["type"]) =>
  (value: unknown): T => {
    if (typeof value !== "string") throw new Error("geography column returned a non-string");
    const geo = parseEwkb(value);
    if (geo.type !== type) throw new Error(`expected ${type}, got ${geo.type}`);
    return geo as T;
  };

/**
 * geography(Point, 4326): metres on a sphere, no reprojection.
 * dataType is bare "geography" because drizzle-kit double-quotes any custom type
 * it does not know, and "geography(Point, 4326)" is not an identifier. The
 * hand-written geography_typmod migration applies the real typmod.
 */
export const geographyPoint = customType<{ data: GeoPoint; driverData: string }>({
  dataType: () => "geography",
  toDriver(value) {
    assertLonLat(value.coordinates);
    return sql`ST_GeomFromGeoJSON(${JSON.stringify(value)}::text)::geography`;
  },
  fromDriver: fromGeography<GeoPoint>("Point"),
});

/** geography(Polygon, 4326); typmod applied by the geography_typmod migration. */
export const geographyPolygon = customType<{ data: GeoPolygon; driverData: string }>({
  dataType: () => "geography",
  toDriver(value) {
    value.coordinates.forEach((ring) => ring.forEach(assertLonLat));
    return sql`ST_GeomFromGeoJSON(${JSON.stringify(value)}::text)::geography`;
  },
  fromDriver: fromGeography<GeoPolygon>("Polygon"),
});

/** bit(64) as a 64-character '0'|'1' string: the dHash. */
export const bit64 = customType<{ data: string; driverData: string }>({
  dataType: () => "bit(64)",
  toDriver(value) {
    if (!/^[01]{64}$/.test(value)) throw new Error("bit64 expects 64 characters of 0/1");
    return value;
  },
});

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});
