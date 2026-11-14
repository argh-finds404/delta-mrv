// Error Level Analysis (ELA), the arithmetic half: given a photo's pixels and the pixels of the
// same photo re-saved as JPEG at a known quality, show where they differ. Areas that were saved
// the same number of times settle alike; a pasted or retouched patch often settles differently.
// A reading aid for a reviewer, never a finding: edges, text, sky and any re-saved file light up
// too. Runs in the browser only (src/components/lab/useEla.ts); nothing is stored.

/** The JPEG quality the photo is re-saved at. */
export const ELA_QUALITY = 0.9;
/** How much a difference is amplified before it is drawn: small differences must be visible. */
export const ELA_GAIN = 12;

export type ElaResult = {
  /** RGBA, the same size as the input: black where nothing changed, through red and yellow to white. */
  pixels: Uint8ClampedArray<ArrayBuffer>;
  /** The largest per-pixel difference, 0 to 255, before amplification. */
  max: number;
  /** The mean per-pixel difference, before amplification. */
  mean: number;
};

/**
 * Per pixel, the largest of the three channel differences between `original` and `recompressed`
 * (both RGBA, same size), amplified by `gain` and drawn on a heat ramp. Alpha is ignored and the
 * output is opaque.
 */
export function elaHeatmap(original: Uint8ClampedArray, recompressed: Uint8ClampedArray, gain = ELA_GAIN): ElaResult {
  if (original.length !== recompressed.length || original.length % 4 !== 0) throw new Error("ELA needs two RGBA images of the same size");
  const pixels = new Uint8ClampedArray(original.length);
  let max = 0;
  let sum = 0;
  for (let i = 0; i < original.length; i += 4) {
    const d = Math.max(Math.abs(original[i]! - recompressed[i]!), Math.abs(original[i + 1]! - recompressed[i + 1]!), Math.abs(original[i + 2]! - recompressed[i + 2]!));
    if (d > max) max = d;
    sum += d;
    const v = Math.min(255, d * gain) / 255;
    pixels[i] = Math.round(255 * Math.min(1, v * 1.5));
    pixels[i + 1] = Math.round(255 * Math.max(0, Math.min(1, v * 1.5 - 0.4)));
    pixels[i + 2] = Math.round(255 * Math.max(0, Math.min(1, v * 2.5 - 1.5)));
    pixels[i + 3] = 255;
  }
  return { pixels, max, mean: original.length ? sum / (original.length / 4) : 0 };
}
