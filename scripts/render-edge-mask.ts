// The hero's edge mask: an organic, ragged silhouette (white, alpha-shaped) that lets each
// photograph dissolve into the paper instead of ending in a straight-edged rectangle.
// Deterministic: same seed, same mask.
//
//   pnpm tsx scripts/render-edge-mask.ts
import sharp from "sharp";

const W = 1000;
const H = 700;
const OUT = "public/images/life/edge-mask.png";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise in [0, 1], several octaves. */
function noise(seed: number, cell: number, octaves: number): Float32Array {
  const out = new Float32Array(W * H);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++, cell /= 2, amp /= 2) {
    const rand = mulberry32(seed * 131 + o);
    const gw = Math.ceil(W / cell) + 2;
    const grid = Float32Array.from({ length: gw * (Math.ceil(H / cell) + 2) }, rand);
    const s = (t: number) => t * t * (3 - 2 * t);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const [gx, gy] = [x / cell, y / cell];
        const [x0, y0] = [Math.floor(gx), Math.floor(gy)];
        const [tx, ty] = [s(gx - x0), s(gy - y0)];
        const a = grid[y0 * gw + x0]! + (grid[y0 * gw + x0 + 1]! - grid[y0 * gw + x0]!) * tx;
        const b = grid[(y0 + 1) * gw + x0]! + (grid[(y0 + 1) * gw + x0 + 1]! - grid[(y0 + 1) * gw + x0]!) * tx;
        out[y * W + x] = out[y * W + x]! + (a + (b - a) * ty) * amp;
      }
    total += amp;
  }
  return out.map((v) => v / total);
}

async function main() {
  const ragged = noise(5, 60, 4);
  const px = Buffer.alloc(W * H * 4, 255);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ex = (x / W - 0.5) * 2;
      const ey = (y / H - 0.5) * 2;
      const ang = Math.atan2(ey, ex);
      // a lobed rim, ragged by noise, kept clear of the frame so nothing is ever cut flat
      const rim = 0.93 + 0.04 * Math.sin(3 * ang + 1.3) + 0.03 * Math.sin(5 * ang + 0.4) + 0.015 * Math.sin(11 * ang + 2);
      const d = Math.hypot(ex * 0.96, ey * 0.98) / rim + (ragged[y * W + x]! - 0.5) * 0.2;
      const margin = Math.min(1, Math.min(x, W - 1 - x, y, H - 1 - y) / 24);
      px[(y * W + x) * 4 + 3] = Math.round((1 - Math.min(1, Math.max(0, (d - 0.9) / 0.09))) * margin * 255);
    }
  await sharp(px, { raw: { width: W, height: H, channels: 4 } }).png().toFile(OUT);
  console.log(`wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
