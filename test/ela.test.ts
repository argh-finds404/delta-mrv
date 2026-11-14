import { describe, expect, it } from "vitest";
import { elaHeatmap } from "../src/lib/forensics/ela";

const rgba = (...px: [number, number, number][]) => new Uint8ClampedArray(px.flatMap(([r, g, b]) => [r, g, b, 255]));

describe("elaHeatmap", () => {
  it("is black where re-saving changed nothing, and opaque everywhere", () => {
    const img = rgba([10, 20, 30], [200, 100, 50]);
    const out = elaHeatmap(img, img);
    expect([...out.pixels]).toEqual([0, 0, 0, 255, 0, 0, 0, 255]);
    expect(out).toMatchObject({ max: 0, mean: 0 });
  });

  it("takes the largest channel difference, amplifies it, and grows from red to white", () => {
    const original = rgba([100, 100, 100], [100, 100, 100], [100, 100, 100]);
    const resaved = rgba([102, 100, 99], [100, 110, 100], [100, 100, 160]);
    const out = elaHeatmap(original, resaved, 12);
    expect(out.max).toBe(60);
    expect(out.mean).toBeCloseTo((2 + 10 + 60) / 3);
    const at = (i: number) => [...out.pixels.slice(i * 4, i * 4 + 4)];
    // 2 x 12 = 24 of 255: a dim red, no green or blue yet
    expect(at(0)[0]).toBeGreaterThan(0);
    expect(at(0).slice(1, 3)).toEqual([0, 0]);
    // 10 x 12 = 120: brighter red, some green, still no blue
    expect(at(1)[0]).toBeGreaterThan(at(0)[0]!);
    expect(at(1)[1]).toBeGreaterThan(0);
    expect(at(1)[2]).toBe(0);
    // 60 x 12 saturates: white
    expect(at(2)).toEqual([255, 255, 255, 255]);
  });

  it("ignores alpha, and refuses images of different sizes", () => {
    const a = new Uint8ClampedArray([5, 5, 5, 0]);
    const b = new Uint8ClampedArray([5, 5, 5, 255]);
    expect(elaHeatmap(a, b).max).toBe(0);
    expect(() => elaHeatmap(a, new Uint8ClampedArray(8))).toThrow(/same size/);
  });
});
