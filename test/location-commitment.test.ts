import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { locationCommitment } from "../src/lib/crypto/location";

const SALT = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const POLYGON = { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };

describe("locationCommitment (docs/02-ARCHITECTURE.md §4.3)", () => {
  it("is SHA256('DELTA_LOC_V1:' + salt_hex + ':' + RFC 8785 canonical GeoJSON)", async () => {
    // Canonical form written by hand: keys sorted, no whitespace.
    const canonical = '{"coordinates":[[[0,0],[1,0],[1,1],[0,0]]],"type":"Polygon"}';
    const expected = createHash("sha256").update(`DELTA_LOC_V1:${SALT}:${canonical}`).digest("hex");
    expect(await locationCommitment(SALT, POLYGON)).toBe(expected);
  });

  it("does not depend on key order in the GeoJSON", async () => {
    const reordered = { coordinates: POLYGON.coordinates, type: "Polygon" };
    expect(await locationCommitment(SALT, reordered)).toBe(await locationCommitment(SALT, POLYGON));
  });

  it("changes with the salt and with the geometry", async () => {
    const base = await locationCommitment(SALT, POLYGON);
    expect(await locationCommitment(SALT.replace(/^00/, "01"), POLYGON)).not.toBe(base);
    const moved = { ...POLYGON, coordinates: [[[0, 0], [1, 0], [1, 2], [0, 0]]] };
    expect(await locationCommitment(SALT, moved)).not.toBe(base);
  });

  it("is 64 lowercase hex characters", async () => {
    expect(await locationCommitment(SALT, POLYGON)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses a salt that is not lowercase hex", async () => {
    await expect(locationCommitment("NOT-HEX", POLYGON)).rejects.toThrow(/salt/);
    await expect(locationCommitment(SALT.toUpperCase(), POLYGON)).rejects.toThrow(/salt/);
  });
});
