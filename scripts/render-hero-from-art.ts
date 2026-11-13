// Prepares the landing hero's four scenes from the maintainer's watercolour illustrations in
// art/hero/ (the originals: kept out of public/ so they are never served, and out of git). They
// are illustrations of delta landscapes, not maps of the demo sites, and the page says so. Per scene, three files, the inputs of src/components/hero/DrawnWatercolor.tsx:
//
//   public/images/hero/<name>.webp        the painting, 1800 x 900, thinned into the page's paper
//   public/images/hero/<name>-ink.webp    R: when each ink line is drawn (0..1); G: where ink is
//   public/images/hero/<name>-wash.webp   R: when the colour wash reaches each place (0..1)
//   src/components/hero/watercolour.json  per-scene timing and the paper colour
//
//   pnpm tsx scripts/render-hero-from-art.ts
//
// Deterministic: same source art, same files.
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const W = 1800;
const H = 900;
const PAPER: [number, number, number] = [244, 241, 234]; // --paper, src/app/globals.css
const SRC = "art/hero";
const OUT = "public/images/hero";
const META = "src/components/hero/watercolour.json";

// `top`: where the 2:1 window sits in a taller source, 0 = top edge, 1 = bottom edge.
// `ownPaper`: the source shows bare paper, so its paper tone is mapped onto the page's.
const SCENES = [
  { name: "mangrove", file: /^Map_illustration_of_river_delta\.jpg$/, top: 0.55, ownPaper: true, seed: 11 },
  { name: "river", file: /^Watercolor_map_illustration_of_r.*\.jpg$/, top: 0.5, ownPaper: true, seed: 37 },
  { name: "haor", file: /^Watercolor_map_of_wetland_basin_.*\.jpg$/, top: 0.6, ownPaper: true, seed: 23 },
  { name: "coast", file: /^image\.png_.*\.jpg$/, top: 0.42, ownPaper: false, seed: 41 },
] as const;

// ---------------------------------------------------------------------------------------------
// Noise (deterministic)

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(seed: number, w: number, h: number, cell: number): Float32Array {
  const r = rng(seed);
  const gw = Math.ceil(w / cell) + 2;
  const gh = Math.ceil(h / cell) + 2;
  const grid = Float32Array.from({ length: gw * gh }, () => r());
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const fx = x / cell;
      const fy = y / cell;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const sx = (fx - ix) * (fx - ix) * (3 - 2 * (fx - ix));
      const sy = (fy - iy) * (fy - iy) * (3 - 2 * (fy - iy));
      const g = (i: number, j: number) => grid[(iy + j) * gw + (ix + i)]!;
      out[y * w + x] = (g(0, 0) * (1 - sx) + g(1, 0) * sx) * (1 - sy) + (g(0, 1) * (1 - sx) + g(1, 1) * sx) * sy;
    }
  return out;
}

const fbm = (seed: number, w: number, h: number, cell: number) => {
  const a = valueNoise(seed, w, h, cell);
  const b = valueNoise(seed + 1, w, h, cell / 2.3);
  const c = valueNoise(seed + 2, w, h, cell / 5.1);
  return a.map((v, i) => v * 0.6 + b[i]! * 0.28 + c[i]! * 0.12);
};

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------------------------

/**
 * How much of the painting is laid at each pixel: 1 in the body, 0 on bare paper. The outline
 * is a loose blot, not the picture's rectangle: a rounded shape pushed in and out by noise at
 * three scales, so the painting sits on the page the way a wash sits on paper, with no frame.
 */
function bodyMask(seed: number, w: number, h: number): Float32Array {
  const big = fbm(seed + 13, w, h, w / 6);
  const mid = fbm(seed + 17, w, h, w / 22);
  const fine = fbm(seed + 19, w, h, w / 90);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const u = Math.abs((x / (w - 1)) * 2 - 1);
      const v = Math.abs((y / (h - 1)) * 2 - 1);
      const r = (u ** 2.6 + v ** 2.6) ** (1 / 2.6);
      const lobes = (big[i]! - 0.5) * 0.85 + (mid[i]! - 0.5) * 0.3 + (fine[i]! - 0.5) * 0.08;
      // never paint at the picture's own edge, however far a lobe reaches
      const inside = smoothstep(0, 0.07, 1 - Math.max(u, v));
      out[i] = smoothstep(0.07, 0.2, 1 - r + lobes) * inside;
    }
  return out;
}

async function prepare(scene: (typeof SCENES)[number]) {
  const name = readdirSync(SRC).find((f) => scene.file.test(f));
  if (!name) throw new Error(`no source art in ${SRC} matches ${scene.file}`);
  const meta = await sharp(`${SRC}/${name}`).metadata();
  const sw = meta.width;
  const sh = meta.height;
  const ch = Math.min(sh, Math.round(sw / 2));
  const src = await sharp(`${SRC}/${name}`)
    .extract({ left: 0, top: Math.round((sh - ch) * scene.top), width: sw, height: ch })
    .resize(W, H, { kernel: "lanczos3" })
    .removeAlpha()
    .raw()
    .toBuffer();

  // the source's own paper tone: the mean of its brightest fiftieth
  const gain = [1, 1, 1];
  if (scene.ownPaper) {
    const lum = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) lum[i] = src[i * 3]! * 0.3 + src[i * 3 + 1]! * 0.59 + src[i * 3 + 2]! * 0.11;
    const cut = Float32Array.from(lum).sort()[Math.floor(W * H * 0.98)]!;
    const sum = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < W * H; i++)
      if (lum[i]! >= cut) {
        for (let c = 0; c < 3; c++) sum[c]! += src[i * 3 + c]!;
        n++;
      }
    for (let c = 0; c < 3; c++) gain[c] = PAPER[c]! / (sum[c]! / n);
  }

  const body = bodyMask(scene.seed, W, H);
  const out = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    const b = body[i]!;
    // pigment pools a little darker along the edge of a wash
    const rim = 1 - 0.07 * 4 * b * (1 - b);
    for (let c = 0; c < 3; c++) {
      const v = Math.min(PAPER[c]!, src[i * 3 + c]! * gain[c]!);
      out[i * 3 + c] = Math.round(PAPER[c]! * (1 - b) + v * rim * b);
    }
  }

  // ink: the painting's own dark lines, each pixel darker than its neighbourhood
  const IW = 720;
  const IH = 360;
  const grey = sharp(out, { raw: { width: W, height: H, channels: 3 } }).resize(IW, IH, { kernel: "cubic" }).greyscale();
  const sharpL = await grey.clone().raw().toBuffer();
  const softL = await grey.clone().blur(3).raw().toBuffer();
  const order = fbm(scene.seed + 31, IW, IH, 70);
  const ink = Buffer.alloc(IW * IH * 3);
  for (let y = 0; y < IH; y++)
    for (let x = 0; x < IW; x++) {
      const i = y * IW + x;
      const on = smoothstep(0.02, 0.085, (softL[i]! - sharpL[i]!) / 255);
      // drawn from the centre outward, unevenly, over the ink phase
      const dist = Math.hypot((x - IW / 2) / IW, (y - IH / 2) / IH) / 0.56;
      const t = Math.min(1, Math.max(0, dist * 0.75 + (order[i]! - 0.5) * 0.5 + 0.1));
      ink[i * 3] = Math.round(t * 255);
      ink[i * 3 + 1] = Math.round(on * 255);
    }

  // the wash: arrives in pools from a few points, unevenly, water first then land
  const WW = 450;
  const WH = 225;
  const small = await sharp(out, { raw: { width: W, height: H, channels: 3 } }).resize(WW, WH).raw().toBuffer();
  const r = rng(scene.seed + 101);
  const seeds = Array.from({ length: 4 }, () => [0.2 + r() * 0.6, 0.2 + r() * 0.6] as const);
  const flow = fbm(scene.seed + 47, WW, WH, 30);
  const wash = Buffer.alloc(WW * WH * 3);
  for (let y = 0; y < WH; y++)
    for (let x = 0; x < WW; x++) {
      const i = y * WW + x;
      const near = Math.min(...seeds.map(([sx, sy]) => Math.hypot(x / WW - sx, (y / WH - sy) * 0.5)));
      const water = -0.16 * smoothstep(0.02, 0.14, (small[i * 3 + 2]! - small[i * 3]!) / 255);
      const t = Math.min(1, Math.max(0, near * 1.55 + (flow[i]! - 0.5) * 0.45 + water + 0.06));
      wash[i * 3] = Math.round(t * 255);
    }

  mkdirSync(OUT, { recursive: true });
  await sharp(out, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 82 }).toFile(`${OUT}/${scene.name}.webp`);
  await sharp(ink, { raw: { width: IW, height: IH, channels: 3 } }).webp({ lossless: true }).toFile(`${OUT}/${scene.name}-ink.webp`);
  await sharp(wash, { raw: { width: WW, height: WH, channels: 3 } }).blur(1.2).webp({ lossless: true }).toFile(`${OUT}/${scene.name}-wash.webp`);
  console.log(`prepared ${scene.name} from ${name}`);
}

async function main() {
  // HERO_ONLY=coast re-renders one scene while tuning
  for (const s of SCENES) if (!process.env.HERO_ONLY || process.env.HERO_ONLY === s.name) await prepare(s);
  const meta = Object.fromEntries(
    SCENES.map((s) => [s.name, { inkEnd: 1.6, washFrom: 1.0, washEnd: 3.8, paper: PAPER.map((v) => +(v / 255).toFixed(3)) }]),
  );
  writeFileSync(META, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`wrote ${META}`);
}

void main();
