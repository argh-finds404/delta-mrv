import { describe, expect, it } from "vitest";
import { hammingDistance, packDHash } from "../src/lib/forensics/dhash";

// 9 columns x 8 rows, row-major, as docs/02-ARCHITECTURE.md §4.2 specifies.
const grid = (f: (row: number, col: number) => number) =>
  Uint8Array.from({ length: 72 }, (_, i) => f(Math.floor(i / 9), i % 9));

describe("packDHash", () => {
  it("is all zeros for a flat image (left > right is never true)", () => {
    expect(packDHash(grid(() => 128))).toBe("0".repeat(64));
  });

  it("is all ones when every pixel is brighter than its right neighbour", () => {
    expect(packDHash(grid((_, c) => 255 - c * 10))).toBe("1".repeat(64));
  });

  it("packs row-major, most significant bit first", () => {
    // Only row 0, columns 0 and 7 are brighter than their right neighbour.
    const px = grid((r, c) => (r === 0 && (c === 0 || c === 7) ? 200 : 100));
    // row 0: col0 > col1 -> 1; col1..col6 -> 0 (100 vs 100), col6 vs col7: 100 > 200 no -> 0; col7 > col8 -> 1
    expect(packDHash(px)).toBe("10000001" + "0".repeat(56));
  });

  it("rejects anything but 72 pixels", () => {
    expect(() => packDHash(new Uint8Array(64))).toThrow(/72/);
  });
});

describe("hammingDistance", () => {
  it("counts differing bits", () => {
    expect(hammingDistance("0".repeat(64), "0".repeat(64))).toBe(0);
    expect(hammingDistance("0".repeat(64), "1".repeat(64))).toBe(64);
    expect(hammingDistance("1010" + "0".repeat(60), "1001" + "0".repeat(60))).toBe(2);
  });

  it("rejects strings that are not 64 bits", () => {
    expect(() => hammingDistance("01", "10")).toThrow(/64/);
  });
});
