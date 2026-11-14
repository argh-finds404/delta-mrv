// A site boundary from a file: GeoJSON or KML, as QGIS, a GPS handheld or Google Earth export
// them, to the one closed ring the server accepts. Everything here runs in the browser.
import { describe, expect, it } from "vitest";
import { BoundaryFileError, parseBoundaryFile } from "../src/lib/geo/boundary-file";
import { ringAreaM2, ringPerimeterM, selfIntersection } from "../src/lib/geo/area";

const SQUARE: [number, number][] = [
  [89.0, 22.0],
  [89.01, 22.0],
  [89.01, 22.01],
  [89.0, 22.01],
];
const closed = [...SQUARE, SQUARE[0]!];

describe("area and perimeter on the sphere", () => {
  it("measures a 0.01 degree square near the equator at about 1.24 square kilometres", () => {
    const eq: [number, number][] = [[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01]];
    expect(ringAreaM2(eq)).toBeGreaterThan(1_233_000);
    expect(ringAreaM2(eq)).toBeLessThan(1_245_000);
    expect(ringPerimeterM(eq)).toBeCloseTo(4 * 1111.95, -1);
  });

  it("gives the same area whether the ring is closed or open, and whichever way it turns", () => {
    expect(ringAreaM2(closed)).toBeCloseTo(ringAreaM2(SQUARE), 6);
    expect(ringAreaM2([...SQUARE].reverse())).toBeCloseTo(ringAreaM2(SQUARE), 6);
  });

  it("finds where a bow-tie crosses itself, and nothing in a plain square", () => {
    expect(selfIntersection(SQUARE)).toBeNull();
    expect(selfIntersection([[0, 0], [1, 1], [1, 0], [0, 1]])).toEqual([1, 3]);
  });
});

describe("a GeoJSON boundary", () => {
  it("reads a Feature, a bare Polygon and a FeatureCollection, dropping altitude and the closing point", () => {
    const feature = { type: "Feature", properties: { name: "Koyra plot 4" }, geometry: { type: "Polygon", coordinates: [closed.map(([x, y]) => [x, y, 3.2])] } };
    for (const doc of [feature, feature.geometry, { type: "FeatureCollection", features: [feature] }]) {
      const out = parseBoundaryFile(JSON.stringify(doc), "site.geojson");
      expect(out.format).toBe("GeoJSON");
      expect(out.ring).toEqual(SQUARE);
    }
    expect(parseBoundaryFile(JSON.stringify(feature)).name).toBe("Koyra plot 4");
  });

  it("takes a MultiPolygon of one area, and refuses one of several, saying how many", () => {
    const one = { type: "MultiPolygon", coordinates: [[closed]] };
    expect(parseBoundaryFile(JSON.stringify(one)).ring).toEqual(SQUARE);
    const two = { type: "MultiPolygon", coordinates: [[closed], [closed.map(([x, y]) => [x + 1, y])]] };
    expect(() => parseBoundaryFile(JSON.stringify(two))).toThrow(/2 separate areas/);
  });

  it("keeps the outer edge of a polygon with holes, and says the holes were left out", () => {
    const hole = [[89.004, 22.004], [89.006, 22.004], [89.006, 22.006], [89.004, 22.004]];
    const out = parseBoundaryFile(JSON.stringify({ type: "Polygon", coordinates: [closed, hole] }));
    expect(out.ring).toEqual(SQUARE);
    expect(out.warnings.join(" ")).toMatch(/1 hole/);
  });

  it("refuses what cannot be a site boundary, each with a reason a person can act on", () => {
    const cases: [unknown, RegExp][] = [
      [{ type: "LineString", coordinates: closed }, /no polygon/i],
      [{ type: "Polygon", coordinates: [[[89, 22], [89.01, 22], [89, 22]]] }, /at least three/i],
      [{ type: "Polygon", coordinates: [[[189, 22], [189.01, 22], [189.01, 22.01], [189, 22]]] }, /longitude/i],
      [{ type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]] }, /crosses itself/i],
      [{ type: "Polygon", crs: { type: "name", properties: { name: "EPSG:32645" } }, coordinates: [closed] }, /EPSG:32645/],
    ];
    for (const [doc, why] of cases) expect(() => parseBoundaryFile(JSON.stringify(doc))).toThrow(why);
    expect(() => parseBoundaryFile("{ not json")).toThrow(BoundaryFileError);
  });
});

describe("a KML boundary", () => {
  const kml = (coords: string, extra = "") => `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Haor east</name>
<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs>${extra}</Polygon>
</Placemark></Document></kml>`;
  const text = closed.map(([x, y]) => `${x},${y},0`).join("\n  ");

  it("reads Google Earth's outer boundary and the placemark's name", () => {
    const out = parseBoundaryFile(kml(text), "site.kml");
    expect(out).toMatchObject({ format: "KML", name: "Haor east", ring: SQUARE });
  });

  it("reads a namespaced file and notes inner boundaries it leaves out", () => {
    const prefixed = kml(text, "<innerBoundaryIs><LinearRing><coordinates>89.004,22.004 89.006,22.004 89.006,22.006 89.004,22.004</coordinates></LinearRing></innerBoundaryIs>")
      .replaceAll("<Polygon>", "<kml:Polygon>")
      .replaceAll("</Polygon>", "</kml:Polygon>");
    const out = parseBoundaryFile(prefixed);
    expect(out.ring).toEqual(SQUARE);
    expect(out.warnings.join(" ")).toMatch(/1 hole/);
  });

  it("refuses a KMZ, and a file with no polygon", () => {
    expect(() => parseBoundaryFile("PK\u0003\u0004 binary", "site.kmz")).toThrow(/unzip/i);
    expect(() => parseBoundaryFile("<kml><Document><Placemark><Point><coordinates>89,22</coordinates></Point></Placemark></Document></kml>")).toThrow(/no polygon/i);
  });
});
