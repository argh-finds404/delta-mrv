// The shared half of the 64-bit dHash (docs/02-ARCHITECTURE.md §4.2). Intake, the seed
// script and the eval harness must all pack the same way; each runs its own image step
// first: grayscale, THEN resize to 9 columns x 8 rows (the order changes the hash).

const COLS = 9;
const ROWS = 8;

/** 72 grayscale pixels, row-major -> 64-character '0'|'1' string, row-major, MSB first. */
export function packDHash(gray: Uint8Array): string {
  if (gray.length !== COLS * ROWS) throw new Error(`dHash needs ${COLS * ROWS} pixels, got ${gray.length}`);
  let bits = "";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      bits += gray[r * COLS + c]! > gray[r * COLS + c + 1]! ? "1" : "0";
    }
  }
  return bits;
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== 64 || b.length !== 64) throw new Error("hammingDistance needs two 64-bit strings");
  let d = 0;
  for (let i = 0; i < 64; i++) if (a[i] !== b[i]) d++;
  return d;
}
