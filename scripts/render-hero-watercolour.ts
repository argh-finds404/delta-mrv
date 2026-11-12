// Paints the landing hero's four scenes from real satellite imagery of the four seeded sites'
// regions: Sentinel-2 cloudless 2016 by EOX (CC BY 4.0, credited on the page and in the footer).
// Each view is centred on the project's PUBLIC fuzzed point, at a regional zoom, so no exact
// site is shown. Per scene, three files, the inputs of src/components/hero/DrawnWatercolor.tsx:
//
//   public/images/hero/<name>.webp        the finished watercolour, 1800 x 900, on paper
//   public/images/hero/<name>-ink.webp    R: when each ink line is drawn (0..1); G: where ink is
//   public/images/hero/<name>-wash.webp   R: when the colour wash reaches each place (0..1)
//   src/components/hero/watercolour.json  per-scene timing and the paper colour
//
//   pnpm tsx scripts/render-hero-watercolour.ts
//
// Deterministic from the tiles: same imagery, same paintings. Tiles are cached in the OS temp dir.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const W = 1800;
const H = 900;
const ZOOM = 12;
const TILE = 256;
const PAPER: [number, number, number] = [244, 241, 234];
const OUT = "public/images/hero";
const META = "src/components/hero/watercolour.json";
const CACHE = join(tmpdir(), "delta-eox-s2cloudless-2016");
const TILE_URL = (z: number, x: number, y: number) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${z}/${y}/${x}.jpg`;

// The four seeded projects' public (fuzzed) points, from impact_project.fuzzed_centroid.
const SCENES = [
  { name: "mangrove", lat: 22.325, lon: 89.325, seed: 11, strict: false },
  { name: "haor", lat: 25.125, lon: 91.075, seed: 23, strict: false },
  { name: "river", lat: 23.25, lon: 90.62, seed: 37, strict: false }, // the Padma–Meghna confluence south of the Buriganga point, where the rivers read clearly
  { name: "coast", lat: 21.475, lon: 91.875, seed: 41, strict: false },
] as const;

// ---------------------------------------------------------------------------------------------
// Imagery

const lonToX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
const latToY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

async function tile(z: number, x: number, y: number): Promise<Buffer> {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, `${z}-${x}-${y}.jpg`);
  if (existsSync(file)) return readFileSync(file);
  const res = await fetch(TILE_URL(z, x, y), { headers: { "user-agent": "delta-mrv hero renderer (one-off, cached)" } });
  if (!res.ok) throw new Error(`tile ${z}/${x}/${y}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(file, buf);
  return buf;
}

/** The W x H window of imagery centred on (lat, lon) at ZOOM, as raw RGB. */
async function imagery(lat: number, lon: number): Promise<Buffer> {
  const cx = lonToX(lon, ZOOM) * TILE;
  const cy = latToY(lat, ZOOM) * TILE;
  const left = Math.round(cx - W / 2);
  const top = Math.round(cy - H / 2);
  const [tx0, ty0, tx1, ty1] = [Math.floor(left / TILE), Math.floor(top / TILE), Math.floor((left + W - 1) / TILE), Math.floor((top + H - 1) / TILE)];
  const composites: { input: Buffer; left: number; top: number }[] = [];
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++) composites.push({ input: await tile(ZOOM, tx, ty), left: (tx - tx0) * TILE, top: (ty - ty0) * TILE });
  const canvas = sharp({ create: { width: (tx1 - tx0 + 1) * TILE, height: (ty1 - ty0 + 1) * TILE, channels: 3, background: "#000" } }).composite(composites);
  const stitched = await canvas.png().toBuffer();
  return sharp(stitched)
    .extract({ left: left - tx0 * TILE, top: top - ty0 * TILE, width: W, height: H })
    .removeAlpha()
    .raw()
    .toBuffer();
}

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
  return a.map((v, i) => (v * 0.6 + b[i]! * 0.28 + c[i]! * 0.12));
};

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------------------------
// Painting

async function paint(scene: (typeof SCENES)[number]) {
  const sat = await imagery(scene.lat, scene.lon);
  // HERO_RAW=1: also write the unpainted imagery beside the tile cache, for tuning the palette
  if (process.env.HERO_RAW) await sharp(sat, { raw: { width: W, height: H, channels: 3 } }).resize(900).jpeg().toFile(join(CACHE, `raw-${scene.name}.jpg`));
  if (process.env.HERO_RAW === "only") return;

  // Read the land from the imagery at a third of the size: water is smooth and carries no green;
  // vegetation is green and textured, darker where denser. Those two fields drive the painting.
  const SW = W / 3;
  const SH = H / 3;
  const small = await sharp(sat, { raw: { width: W, height: H, channels: 3 } }).resize(SW, SH, { kernel: "cubic" }).median(3).raw().toBuffer();
  const L = new Float32Array(SW * SH);
  const G = new Float32Array(SW * SH);
  const B = new Float32Array(SW * SH);
  for (let i = 0; i < SW * SH; i++) {
    const [r, g, b] = [small[i * 3]! / 255, small[i * 3 + 1]! / 255, small[i * 3 + 2]! / 255];
    L[i] = 0.3 * r + 0.59 * g + 0.11 * b;
    G[i] = g - (r + b) / 2;
    B[i] = b - r;
  }
  const box = (src: Float32Array, rad: number) => {
    const out = new Float32Array(SW * SH);
    for (let y = 0; y < SH; y++)
      for (let x = 0; x < SW; x++) {
        let s = 0;
        let n = 0;
        for (let dy = -rad; dy <= rad; dy++)
          for (let dx = -rad; dx <= rad; dx++) {
            const xx = Math.min(SW - 1, Math.max(0, x + dx));
            const yy = Math.min(SH - 1, Math.max(0, y + dy));
            s += src[yy * SW + xx]!;
            n++;
          }
        out[y * SW + x] = s / n;
      }
    return out;
  };
  const mean = box(L, 2);
  const meanSq = box(L.map((v) => v * v), 2);
  const greenAvg = box(G, 2);
  const blueAvg = box(B, 3);
  // relative to this scene: muddy delta water is only a little less green than its land
  const greenMid = Float32Array.from(greenAvg).sort()[Math.floor(SW * SH * 0.5)]!;
  const lumaMid = Float32Array.from(mean).sort()[Math.floor(SW * SH * 0.5)]!;
  const water = new Float32Array(SW * SH);
  for (let i = 0; i < SW * SH; i++) {
    const texture = Math.sqrt(Math.max(0, meanSq[i]! - mean[i]! * mean[i]!));
    const smooth = smoothstep(0.035, 0.012, texture);
    const lessGreen = smoothstep(greenMid + 0.004, greenMid - 0.018, greenAvg[i]!);
    // brighter than the scene's middle (canopy is dark), not blown out (sand, cloud)
    const lit = smoothstep(lumaMid - 0.02, lumaMid + 0.06, mean[i]!) * smoothstep(0.82, 0.68, mean[i]!);
    // open sea is darker than the land but bluer than red, which brown river water never is
    // (and less green than the scene's middle, which dense mangrove canopy never is)
    const sea =
      smoothstep(0.05, 0.02, texture) * smoothstep(0.0, 0.035, blueAvg[i]!) * smoothstep(0.08, 0.14, mean[i]!) * smoothstep(greenMid + 0.008, greenMid - 0.012, greenAvg[i]!);
    // strict: on a dry-season floodplain the fields are as smooth as the river; only colour tells them apart
    water[i] = Math.max(smooth * lit * (scene.strict ? lessGreen * lessGreen : 0.3 + 0.7 * lessGreen), scene.strict ? 0 : sea);
  }
  const waterSoft = box(box(water, 2), 1);
  const up = async (field: Float32Array) =>
    new Float32Array(
      await sharp(Buffer.from(field.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255))), { raw: { width: SW, height: SH, channels: 1 } })
        .resize(W, H, { kernel: "cubic" })
        .extractChannel(0)
        .raw()
        .toBuffer(),
    ).map((v) => v / 255);
  const waterUp = await up(waterSoft);
  const lumaUp = await up(box(L, 1).map((v) => smoothstep(0.12, 0.62, v)));
  const greenUp = await up(box(G, 1).map((v) => smoothstep(-0.02, 0.06, v)));

  const rag = fbm(scene.seed, W, H, 46);
  const mottle = fbm(scene.seed + 3, W, H, 14);
  const grain = fbm(scene.seed + 7, W, H, 3.2);
  const edgeFade = fbm(scene.seed + 13, W, H, 120);
  const col = new Float32Array(W * H * 3);
  const mixc = (a: number[], b: number[], t: number) => a.map((v, k) => v + (b[k]! - v) * t);
  const hexc = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);
  const PAL = {
    waterLight: hexc("#B7D7E6"),
    waterDeep: hexc("#6FA3C7"),
    dense: hexc("#3F7656"),
    forest: hexc("#6E9F5F"),
    field: hexc("#B6C982"),
    sand: hexc("#E6D6AA"),
  };
  const isWater = new Float32Array(W * H);

  for (let i = 0; i < W * H; i++) {
    const w = smoothstep(0.3, 0.44, waterUp[i]! + (rag[i]! - 0.5) * 0.14);
    isWater[i] = w;
    // land: darker and greener is denser vegetation; light and grey is sand, mud or town
    const l = lumaUp[i]!;
    const g = greenUp[i]!;
    const veg = l < 0.45 ? mixc(PAL.dense, PAL.forest, smoothstep(0.1, 0.45, l)) : mixc(PAL.forest, PAL.field, smoothstep(0.45, 0.75, l));
    const land = mixc(PAL.sand, veg, smoothstep(0.05, 0.45, g + (0.5 - l) * 0.6));
    const depth = smoothstep(0.55, 0.95, waterUp[i]!);
    const wat = mixc(PAL.waterLight, PAL.waterDeep, depth);
    // a few flat value steps with ragged edges, then the mottling of uneven pigment
    const steps = 5;
    const shade = Math.round((0.5 + (mottle[i]! - 0.5) * 1.2 + (rag[i]! - 0.5) * 0.5) * steps) / steps;
    const c = mixc(land, wat, w).map((v) => v * (0.9 + 0.16 * shade));
    col[i * 3] = c[0]!;
    col[i * 3 + 1] = c[1]!;
    col[i * 3 + 2] = c[2]!;
  }

  // pooled pigment at the edge of each wash: darken where the posterised colour changes
  const lum = (i: number) => col[i * 3]! * 0.3 + col[i * 3 + 1]! * 0.59 + col[i * 3 + 2]! * 0.11;
  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const xl = Math.max(0, x - 1);
      const xr = Math.min(W - 1, x + 1);
      const yu = Math.max(0, y - 1);
      const yd = Math.min(H - 1, y + 1);
      const wash = (Math.abs(lum(y * W + xr) - lum(y * W + xl)) + Math.abs(lum(yd * W + x) - lum(yu * W + x))) * 2;
      const shore = (Math.abs(isWater[y * W + xr]! - isWater[y * W + xl]!) + Math.abs(isWater[yd * W + x]! - isWater[yu * W + x]!)) * 1.6;
      const edge = Math.min(1, wash + shore);
      // the painting thins into paper toward the frame, raggedly: no rectangle edge
      const nx = Math.min(x, W - 1 - x) / (W * 0.18);
      const ny = Math.min(y, H - 1 - y) / (H * 0.2);
      const body = smoothstep(0.15, 1, Math.min(nx, ny) + (edgeFade[i]! - 0.5) * 0.7);
      const transparency = 0.86 * body;
      const gr = 0.93 + 0.07 * grain[i]!;
      for (let c = 0; c < 3; c++) {
        const pig = col[i * 3 + c]! * (1 - 0.22 * edge);
        const paper = PAPER[c]! / 255;
        // pigment multiplies the paper, as transparent watercolour does
        const v = paper * (1 - transparency) + paper * pig * transparency * 1.02;
        out[i * 3 + c] = Math.round(Math.min(1, v * gr) * 255);
      }
    }

  // ink: the shorelines, where the water mask crosses its middle, at map resolution
  const IW = 768;
  const IH = 384;
  const shoreMap = await sharp(Buffer.from(isWater.map((v) => Math.round(v * 255))), { raw: { width: W, height: H, channels: 1 } })
    .resize(IW, IH, { kernel: "cubic" })
    .blur(0.7)
    .extractChannel(0)
    .raw()
    .toBuffer();
  const mag = new Float32Array(IW * IH);
  for (let y = 1; y < IH - 1; y++)
    for (let x = 1; x < IW - 1; x++) {
      const p = (dx: number, dy: number) => shoreMap[(y + dy) * IW + (x + dx)]!;
      const gx = p(1, -1) + 2 * p(1, 0) + p(1, 1) - p(-1, -1) - 2 * p(-1, 0) - p(-1, 1);
      const gy = p(-1, 1) + 2 * p(0, 1) + p(1, 1) - p(-1, -1) - 2 * p(0, -1) - p(1, -1);
      mag[y * IW + x] = Math.hypot(gx, gy);
    }
  const cut = 260;
  const inkFade = fbm(scene.seed + 29, IW, IH, 40);
  const order = fbm(scene.seed + 31, IW, IH, 70);
  const ink = Buffer.alloc(IW * IH * 3);
  for (let y = 0; y < IH; y++)
    for (let x = 0; x < IW; x++) {
      const i = y * IW + x;
      const nx = Math.min(x, IW - 1 - x) / (IW * 0.18);
      const ny = Math.min(y, IH - 1 - y) / (IH * 0.2);
      const inside = smoothstep(0.2, 0.9, Math.min(nx, ny) + (inkFade[i]! - 0.5) * 0.6);
      const on = mag[i]! > cut ? Math.min(1, (mag[i]! - cut) / cut + 0.5) * inside : 0;
      // drawn from the centre outward, unevenly, over the ink phase
      const dist = Math.hypot((x - IW / 2) / IW, (y - IH / 2) / IH) / 0.56;
      const t = Math.min(1, Math.max(0, dist * 0.75 + (order[i]! - 0.5) * 0.5 + 0.1));
      ink[i * 3] = Math.round(t * 255);
      ink[i * 3 + 1] = Math.round(on * 255);
    }

  // bake the ink into the finished painting, so the end of the animation is the still image
  const inkLarge = await sharp(ink, { raw: { width: IW, height: IH, channels: 3 } }).resize(W, H, { kernel: "cubic" }).raw().toBuffer();
  const INK = [52, 72, 82];
  for (let i = 0; i < W * H; i++) {
    const a = (inkLarge[i * 3 + 1]! / 255) * 0.55;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(out[i * 3 + c]! * (1 - a) + INK[c]! * a);
  }

  // the wash: arrives in pools from a few points, unevenly, water first then land
  const WW = 384;
  const WH = 192;
  const r = rng(scene.seed + 101);
  const seeds = Array.from({ length: 4 }, () => [0.2 + r() * 0.6, 0.2 + r() * 0.6] as const);
  const flow = fbm(scene.seed + 47, WW, WH, 26);
  const tint = await sharp(Buffer.from(isWater.map((v) => Math.round(v * 255))), { raw: { width: W, height: H, channels: 1 } }).resize(WW, WH).extractChannel(0).raw().toBuffer();
  const wash = Buffer.alloc(WW * WH * 3);
  for (let y = 0; y < WH; y++)
    for (let x = 0; x < WW; x++) {
      const i = y * WW + x;
      const near = Math.min(...seeds.map(([sx, sy]) => Math.hypot(x / WW - sx, (y / WH - sy) * 0.5)));
      // the water is laid first, then the land
      const water = -0.16 * (tint[i]! / 255);
      const t = Math.min(1, Math.max(0, near * 1.55 + (flow[i]! - 0.5) * 0.45 + water + 0.06));
      wash[i * 3] = Math.round(t * 255);
    }

  mkdirSync(OUT, { recursive: true });
  await sharp(out, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 86 }).toFile(`${OUT}/${scene.name}.webp`);
  await sharp(ink, { raw: { width: IW, height: IH, channels: 3 } }).webp({ lossless: true }).toFile(`${OUT}/${scene.name}-ink.webp`);
  await sharp(wash, { raw: { width: WW, height: WH, channels: 3 } }).blur(1.2).webp({ lossless: true }).toFile(`${OUT}/${scene.name}-wash.webp`);
  console.log(`painted ${scene.name}`);
}

async function main() {
  // HERO_ONLY=coast re-paints one scene while tuning
  for (const s of SCENES) if (!process.env.HERO_ONLY || process.env.HERO_ONLY === s.name) await paint(s);
  const meta = Object.fromEntries(
    SCENES.map((s) => [s.name, { inkEnd: 1.4, washFrom: 0.9, washEnd: 3.6, paper: PAPER.map((v) => +(v / 255).toFixed(3)) }]),
  );
  writeFileSync(META, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`wrote ${META}`);
}

void main();
