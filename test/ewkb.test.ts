import { describe, expect, it } from "vitest";
import { parseEwkb } from "../src/server/db/schema/types";

// What PostGIS prints for SRID=4326;POINT(1 2) (little-endian, SRID flag set)
const POINT_1_2 = "0101000020E6100000000000000000F03F0000000000000040";

function polygonHex(ring: [number, number][]) {
  const b = Buffer.alloc(1 + 4 + 4 + 4 + 4 + ring.length * 16);
  let o = 0;
  b.writeUInt8(1, o++);
  b.writeUInt32LE(0x20000003, o); // Polygon + SRID flag
  o += 4;
  b.writeUInt32LE(4326, o);
  o += 4;
  b.writeUInt32LE(1, o); // one ring
  o += 4;
  b.writeUInt32LE(ring.length, o);
  o += 4;
  for (const [x, y] of ring) {
    b.writeDoubleLE(x, o);
    b.writeDoubleLE(y, o + 8);
    o += 16;
  }
  return b.toString("hex");
}

describe("parseEwkb", () => {
  it("reads a point as [longitude, latitude]", () => {
    expect(parseEwkb(POINT_1_2)).toEqual({ type: "Point", coordinates: [1, 2] });
  });

  it("reads a polygon ring", () => {
    const ring: [number, number][] = [[89, 22], [90, 22], [90, 23], [89, 22]];
    expect(parseEwkb(polygonHex(ring))).toEqual({ type: "Polygon", coordinates: [ring] });
  });

  it("throws instead of inventing a coordinate", () => {
    expect(() => parseEwkb("0102000020E6100000")).toThrow(/unsupported/); // LineString
    expect(() => parseEwkb("")).toThrow();
  });
});
