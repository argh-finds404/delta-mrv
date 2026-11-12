// The eval (docs/10-FORENSICS.md §8): the labelled fixture classes through the real dHash and the
// real threshold. The expected matches must match, unrelated scenes must not, and the known
// misses (heavy crop, rotation) are measured and printed, not hidden. Lives with the
// integration tests only because the service module needs a configured environment.
import { afterAll, describe, expect, it } from "vitest";
import { hammingDistance } from "../../src/lib/forensics/dhash";
import { EVAL } from "../../src/lib/forensics/eval-results";
import { dHashOf, PERCEPTUAL_THRESHOLD } from "../../src/server/services/forensics.service";
import { LIFE, photo, VARIANTS } from "../fixtures/forensics/images";
import { client } from "./db";

afterAll(() => client.end());

// The published result (/trust) is src/lib/forensics/eval-results.ts. docs/10 §8 hoped crops of
// 10% would match; they do not (distances 8–13), and one 50% resize sits exactly on the
// threshold. If the pipeline drifts, this goes red: re-run the eval and re-publish, never
// quietly re-baseline.
const MEASURED_MATCHES = Object.fromEntries(EVAL.classes.map((c) => [c.key, [c.matched, c.of]]));

describe("forensics eval", () => {
  it("recompression always matches, a different scene never does, and the misses are the measured ones", async () => {
    const names = Object.keys(LIFE) as (keyof typeof LIFE)[];
    const base = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await photo(n)] as const))) as Record<keyof typeof LIFE, Buffer>;
    const hash = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await dHashOf(base[n])] as const))) as Record<keyof typeof LIFE, string>;

    const rows: { photo: string; variant: string; distance: number; match: boolean }[] = [];
    for (const n of names) {
      for (const [variant, edit] of Object.entries(VARIANTS)) {
        const distance = hammingDistance(hash[n], await dHashOf(await edit(base[n])));
        rows.push({ photo: n, variant, distance, match: distance < PERCEPTUAL_THRESHOLD });
      }
      for (const other of names.filter((o) => o !== n)) {
        const distance = hammingDistance(hash[n], hash[other]);
        rows.push({ photo: n, variant: `different scene (${other})`, distance, match: distance < PERCEPTUAL_THRESHOLD });
      }
    }
    console.table(rows);

    const counted: Record<string, [number, number]> = {};
    for (const r of rows) {
      const cls = r.variant.startsWith("different scene") ? "different scene" : r.variant;
      const [m, n] = counted[cls] ?? [0, 0];
      counted[cls] = [m + (r.match ? 1 : 0), n + 1];
    }
    expect(counted).toEqual(MEASURED_MATCHES);
    expect(EVAL.threshold).toBe(PERCEPTUAL_THRESHOLD);
  });
});
