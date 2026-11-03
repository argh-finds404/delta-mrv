import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { DHASH_RESIZE, hammingDistance, packDHash } from "../src/lib/forensics/dhash";

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

// The resize kernel is part of the contract (docs/02-ARCHITECTURE.md §4.2). A caller that
// takes sharp's default, or another kernel, still produces a plausible 64-bit hash, just
// not the same one, and duplicate detection between the two quietly misses.
describe("DHASH_RESIZE", () => {
  it("is 9x8, fill, lanczos3, written out and not left to a default", () => {
    expect(DHASH_RESIZE).toEqual({ width: 9, height: 8, fit: "fill", kernel: "lanczos3" });
  });

  // 96x72 grayscale noise from a fixed seed (mulberry32, seed 42)
  const noise = () => {
    let a = 42;
    const next = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return Buffer.from(Array.from({ length: 96 * 72 }, () => Math.floor(next() * 256)));
  };
  const hashWith = async (resize: object) =>
    packDHash(
      new Uint8Array(
        await sharp(noise(), { raw: { width: 96, height: 72, channels: 1 } })
          .grayscale()
          .resize(resize)
          .raw()
          .toBuffer(),
      ),
    );

  it("produces the pinned hash through sharp (a sharp upgrade that changes lanczos3 fails here)", async () => {
    expect(await hashWith(DHASH_RESIZE)).toBe("0101110101110010110010100110111001011101001000101101010001101100");
  });

  it("differs from another kernel, which is what the pin guards against", async () => {
    const pinned = await hashWith(DHASH_RESIZE);
    expect(await hashWith({ ...DHASH_RESIZE, kernel: "nearest" })).not.toBe(pinned);
    expect(await hashWith({ ...DHASH_RESIZE, kernel: "cubic" })).not.toBe(pinned);
  });
});
