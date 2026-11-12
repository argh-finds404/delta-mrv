// The forensics eval's measured result (docs/10-FORENSICS.md §8), published on /trust (docs/16
// A8). test/integration/forensics-eval.test.ts re-measures it on every integration run and
// fails unless the pipeline still produces exactly these counts, so the page cannot drift
// from the code. Change these numbers only by re-running the eval.

export const EVAL = {
  measuredOn: "2026-11-10",
  threshold: 8,
  sample: "The three licensed wildlife and forest photographs used on the landing page.",
  classes: [
    { label: "Resized to 50%", key: "resized 50%", expect: "match", matched: 2, of: 3, note: "One resize landed exactly on the threshold (distance 8) and was missed." },
    { label: "Re-compressed at quality 60", key: "re-compressed q60", expect: "match", matched: 3, of: 3, note: "" },
    { label: "Cropped by 10% of its area", key: "cropped 10%", expect: "match", matched: 0, of: 3, note: "Missed at distances 8 to 13. dHash does not survive cropping." },
    { label: "Cropped by 40% of its area", key: "cropped 40%", expect: "miss", matched: 0, of: 3, note: "Expected miss." },
    { label: "Rotated 90°", key: "rotated 90°", expect: "miss", matched: 0, of: 3, note: "Expected miss: dHash is not rotation-invariant." },
    { label: "A different scene", key: "different scene", expect: "no match", matched: 0, of: 6, note: "No false match. Different photographs were 25 to 37 apart." },
  ],
} as const;
