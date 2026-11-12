// Paints the landing hero's four watercolour scenes of the Sundarbans (felt.com's hero style):
// an aerial, axonometric view with no frame. Each scene thins out into scattered trees on the
// paper. Each is written as two layers, so the page can show the sketch (ink and dark tree dabs)
// first and sweep the colour in after:
//
//   public/images/hero/<scene>-sketch.webp   ink lines and dark dabs
//   public/images/hero/<scene>-colour.webp   transparent washes
//   src/components/hero/hero-art.json        where each plot, pin and link sits, for the overlays
//
//   pnpm tsx scripts/render-hero-art.ts
//
// Paint model: every wash multiplies the paper through a pigment filter (so overlaps darken, as
// real watercolour does), with a wobbled edge, a darker drying rim, blooms and granulation. The
// result is converted to a transparent layer that reproduces that multiply over the page's paper.
// Deterministic: same code, same pictures.
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const W = 1800;
const H = 1200;
const PAPER = [244, 241, 234] as const;
const OUT = "public/images/hero";
const META = "src/components/hero/hero-art.json";

type Pt = [number, number];
type RGB = [number, number, number];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---- the view: ground (u, v) in 0..1000, seen from above at an angle -----------------------
const ISO = { cx: W / 2, cy: 40, kx: 0.9, ky: 0.58 };
const P = ([u, v]: Pt): Pt => [ISO.cx + (u - v) * ISO.kx, ISO.cy + (u + v) * ISO.ky];
const Pinv = (x: number, y: number): Pt => {
  const a = (x - ISO.cx) / ISO.kx;
  const b = (y - ISO.cy) / ISO.ky;
  return [(a + b) / 2, (b - a) / 2];
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise in [0, 1] over the canvas, several octaves. */
function noise(seed: number, cell: number, octaves: number): Float32Array {
  const out = new Float32Array(W * H);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++, cell /= 2, amp /= 2) {
    const rand = mulberry32(seed * 131 + o);
    const gw = Math.ceil(W / cell) + 2;
    const grid = Float32Array.from({ length: gw * (Math.ceil(H / cell) + 2) }, rand);
    const s = (t: number) => t * t * (3 - 2 * t);
    for (let y = 0; y < H; y++) {
      const gy = y / cell;
      const y0 = Math.floor(gy);
      const ty = s(gy - y0);
      for (let x = 0; x < W; x++) {
        const gx = x / cell;
        const x0 = Math.floor(gx);
        const tx = s(gx - x0);
        const a = grid[y0 * gw + x0]! + (grid[y0 * gw + x0 + 1]! - grid[y0 * gw + x0]!) * tx;
        const b = grid[(y0 + 1) * gw + x0]! + (grid[(y0 + 1) * gw + x0 + 1]! - grid[(y0 + 1) * gw + x0]!) * tx;
        out[y * W + x] = out[y * W + x]! + (a + (b - a) * ty) * amp;
      }
    }
    total += amp;
  }
  for (let i = 0; i < out.length; i++) out[i] = out[i]! / total;
  return out;
}

function blur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))]!;
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / n;
      acc += src[y * w + Math.min(w - 1, x + r + 1)]! - src[y * w + Math.max(0, x - r)]!;
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]!;
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / n;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x]! - tmp[Math.max(0, y - r) * w + x]!;
    }
  }
  return out;
}

function rasterize(poly: Pt[], x0: number, y0: number, w: number, h: number): Float32Array {
  const m = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    const y = y0 + j + 0.5;
    const xs: number[] = [];
    for (let k = 0; k < poly.length; k++) {
      const [ax, ay] = poly[k]!;
      const [bx, by] = poly[(k + 1) % poly.length]!;
      if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const s = Math.max(0, Math.ceil(xs[k]! - x0 - 0.5));
      const e = Math.min(w - 1, Math.floor(xs[k + 1]! - x0 - 0.5));
      for (let i = s; i <= e; i++) m[j * w + i] = 1;
    }
  }
  return m;
}

function inside([x, y]: Pt, poly: Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Catmull-Rom through the points, densely sampled. */
function spline(pts: Pt[], per = 14): Pt[] {
  const out: Pt[] = [];
  const at = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))]!;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/** A band of varying width along a ground polyline: its outline, and its two banks. */
function ribbon(centre: Pt[], w0: number, w1: number) {
  const c = spline(centre);
  const left: Pt[] = [];
  const right: Pt[] = [];
  c.forEach((p, i) => {
    const a = c[Math.max(0, i - 1)]!;
    const b = c[Math.min(c.length - 1, i + 1)]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const [nx, ny] = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
    const half = (w0 + (w1 - w0) * (i / (c.length - 1))) / 2;
    left.push([p[0] + nx * half, p[1] + ny * half]);
    right.push([p[0] - nx * half, p[1] - ny * half]);
  });
  return { poly: [...left, ...right.slice().reverse()], left, right };
}

// ---- palettes -----------------------------------------------------------------------------
const PAL = {
  ink: hex("#2A2A22"),
  sketchDab: hex("#2F3B2A"),
  marsh: "#E3D4A4",
  grass: "#C2CF86",
  mud: "#CDB287",
  mudLight: "#DCC79C",
  sand: "#E6D2A0",
  water: "#7DB5D8",
  channel: "#5B95C2",
  sea: "#76B2D4",
  seaDeep: "#4F8DB8",
  path: "#E2D2AC",
  paddy: ["#B5CB72", "#CBD483", "#A7C06A", "#DCCC7E", "#C3CF7C"],
  mangrove: { shadow: hex("#3B5A3E"), body: [hex("#5E8A5C"), hex("#6E9660"), hex("#55805A"), hex("#7FA06A"), hex("#8DA866")], lit: hex("#C2D388") },
  village: { shadow: hex("#465E35"), body: [hex("#7FA05A"), hex("#93AE62"), hex("#6E9452"), hex("#A9B866"), hex("#B8A85C")], lit: hex("#D6D88E") },
  sapling: hex("#7DA552"),
  saplingGrown: hex("#5E8A4C"),
  wall: "#E4D4B2",
  wallShade: "#C2AA84",
  roofs: ["#8E9FA8", "#B5644A", "#C9A86A", "#7F93A0"],
  hull: hex("#76502F"),
  canopy: [hex("#4F6E96"), hex("#B8503A"), hex("#3F7F7A")],
  cloth: ["#C0392B", "#E67E22", "#B03A7A", "#2E6DA4", "#E2B93B", "#2E8B57"].map(hex),
  skin: hex("#5A3B2A"),
};

type Meta = { plots: Pt[][]; pins: Pt[]; link?: [Pt, Pt] };

function scene(seed: number, shape: { cu: number; cv: number; ru: number; rv: number }) {
  const rand = mulberry32(seed);
  const R = (a: number, b: number) => a + rand() * (b - a);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;

  const wx = noise(seed + 1, 80, 3);
  const wy = noise(seed + 2, 80, 3);
  const bloom = noise(seed + 3, 190, 3);
  const gran = noise(seed + 4, 3, 2);
  const pressure = noise(seed + 5, 26, 2);
  const rim = noise(seed + 6, 95, 4);

  // the silhouette: dense in the middle, scattered toward a ragged edge, nothing at the border
  const washF = new Float32Array(W * H);
  const treeF = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const [u, v] = Pinv(x, y);
      const du = Math.abs((u - shape.cu) / shape.ru);
      const dv = Math.abs((v - shape.cv) / shape.rv);
      const d = Math.pow(du ** 2.4 + dv ** 2.4, 1 / 2.4) + (rim[i]! - 0.5) * 0.42;
      const border = Math.min(1, Math.min(x, W - 1 - x, y, H - 1 - y) / 60);
      washF[i] = (1 - smoothstep(0.58, 0.93, d)) * border;
      treeF[i] = (1 - smoothstep(0.7, 1.16, d)) * border;
    }

  const colour = [new Float32Array(W * H).fill(1), new Float32Array(W * H).fill(1), new Float32Array(W * H).fill(1)];
  const sketch = [new Float32Array(W * H).fill(1), new Float32Array(W * H).fill(1), new Float32Array(W * H).fill(1)];
  const ink = new Float32Array(W * H);
  const water: Pt[][] = []; // ground polygons that hold no trees
  const meta: Meta = { plots: [], pins: [] };

  const idx = (x: number, y: number) => Math.min(H - 1, Math.max(0, Math.round(y))) * W + Math.min(W - 1, Math.max(0, Math.round(x)));

  function washScreen(poly: Pt[], color: string, op: number, edge = 0.3, warp = 5, fade = 1) {
    const c = hex(color);
    const pad = Math.ceil(warp) + 12;
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs)) - pad);
    const x1 = Math.min(W, Math.ceil(Math.max(...xs)) + pad);
    const y0 = Math.max(0, Math.floor(Math.min(...ys)) - pad);
    const y1 = Math.min(H, Math.ceil(Math.max(...ys)) + pad);
    const w = x1 - x0;
    const h = y1 - y0;
    if (w <= 0 || h <= 0) return;
    const m = rasterize(poly, x0, y0, w, h);
    const warped = new Float32Array(w * h);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const gi = (y0 + j) * W + x0 + i;
        const sx = Math.round(i + (wx[gi]! - 0.5) * 2 * warp);
        const sy = Math.round(j + (wy[gi]! - 0.5) * 2 * warp);
        warped[j * w + i] = sx >= 0 && sx < w && sy >= 0 && sy < h ? m[sy * w + sx]! : 0;
      }
    const soft = blur(warped, w, h, 1);
    const inner = blur(warped, w, h, 6);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        const s = soft[k]!;
        if (s <= 0.002) continue;
        const gi = (y0 + j) * W + x0 + i;
        const e = Math.max(0, s - inner[k]!);
        const dens = Math.min(1, (s * (0.74 + 0.5 * bloom[gi]!) * (0.84 + 0.32 * gran[gi]!) + e * edge * 2) * op * Math.pow(washF[gi]!, fade));
        if (dens <= 0) continue;
        for (let ch = 0; ch < 3; ch++) colour[ch]![gi] = colour[ch]![gi]! * (1 - dens * (1 - c[ch]!));
      }
  }
  const wash = (poly: Pt[], color: string, op: number, edge = 0.3, warp = 5, fade = 1) => washScreen(poly.map(P), color, op, edge, warp, fade);

  function dab(layer: Float32Array[], x: number, y: number, r: number, c: RGB, d: number, field: Float32Array | null = treeF, wob = 0.14, rimK = 1.3) {
    const ph = (x * 12.9898 + y * 78.233) % 6.283;
    const reach = r * (1 + wob) + 1.5;
    for (let py = Math.max(0, Math.floor(y - reach)); py <= Math.min(H - 1, Math.ceil(y + reach)); py++)
      for (let px = Math.max(0, Math.floor(x - reach)); px <= Math.min(W - 1, Math.ceil(x + reach)); px++) {
        const dx = px + 0.5 - x;
        const dy = py + 0.5 - y;
        const dist = Math.hypot(dx, dy);
        if (dist > reach) continue;
        const a = Math.atan2(dy, dx);
        const re = r * (1 + wob * (0.6 * Math.sin(3 * a + ph) + 0.4 * Math.sin(5 * a + ph * 1.7)));
        const cover = Math.min(1, Math.max(0, re - dist + 0.7));
        if (cover <= 0) continue;
        const gi = py * W + px;
        const rimDark = dist > re - 1.3 ? rimK : 1;
        const dens = Math.min(1, cover * d * rimDark * (0.86 + 0.28 * gran[gi]!) * (field ? field[gi]! : 1));
        if (dens <= 0) continue;
        for (let ch = 0; ch < 3; ch++) layer[ch]![gi] = layer[ch]![gi]! * (1 - dens * (1 - c[ch]!));
      }
  }

  /** A pen line (screen points): broken by pressure, darkness held to a maximum, not piled up. */
  function pen(pts: Pt[], width: number, d: number, broken = 0.22) {
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, ay] = pts[k]!;
      const [bx, by] = pts[k + 1]!;
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.7));
      for (let s = 0; s < n; s++) {
        const x = ax + ((bx - ax) * s) / n;
        const y = ay + ((by - ay) * s) / n;
        const gi = idx(x, y);
        const p = pressure[gi]!;
        if (p < broken) continue;
        const r = (width * (0.55 + 0.6 * p)) / 2;
        const val = d * (0.45 + 0.55 * p) * Math.min(1, washF[gi]! * 1.4 + 0.15 * treeF[gi]!);
        for (let py = Math.floor(y - r - 1); py <= Math.ceil(y + r + 1); py++)
          for (let px = Math.floor(x - r - 1); px <= Math.ceil(x + r + 1); px++) {
            if (px < 0 || py < 0 || px >= W || py >= H) continue;
            const cover = Math.min(1, Math.max(0, r - Math.hypot(px + 0.5 - x, py + 0.5 - y) + 0.5));
            const q = py * W + px;
            if (cover * val > ink[q]!) ink[q] = cover * val;
          }
      }
    }
  }
  const penG = (pts: Pt[], width: number, d: number, broken = 0.22) => pen(pts.map(P), width, d, broken);

  const isWater = (g: Pt) => water.some((poly) => inside(g, poly));

  // ---- objects --------------------------------------------------------------------------------
  function tree([u, v]: Pt, r: number, kind: "mangrove" | "village" = "mangrove") {
    const [x, y] = P([u, v]);
    const f = treeF[idx(x, y)]!;
    if (f <= 0.02) return;
    const s = r * (0.55 + 0.45 * f);
    const pal = kind === "mangrove" ? PAL.mangrove : PAL.village;
    dab(colour, x + 0.45 * s, y + 0.55 * s, s * 0.95, hex("#6F7458"), 0.2, treeF, 0.14, 1); // cast shadow on the ground
    dab(colour, x, y, s * 0.82, pick(pal.body), 0.3, treeF, 0.2, 1.05);
    for (let k = 0; k < 6; k++) {
      const a = R(0, 6.28);
      const rr = R(0.12, 0.5) * s;
      dab(colour, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85, s * R(0.3, 0.46), pick(pal.body), 0.42, treeF, 0.22, 1.12);
    }
    for (let k = 0; k < 3; k++) dab(colour, x + R(0.1, 0.45) * s, y + R(0.18, 0.5) * s, s * R(0.22, 0.36), pal.shadow, 0.42, treeF, 0.22, 1.08);
    for (let k = 0; k < 2; k++) dab(colour, x - R(0.12, 0.45) * s, y - R(0.18, 0.45) * s, s * R(0.16, 0.28), pal.lit, 0.58, treeF, 0.2, 1);
    dab(sketch, x + 0.32 * s, y + 0.38 * s, s * 0.42, PAL.sketchDab, 0.3, treeF, 0.22, 1.05);
    if (rand() < 0.35) {
      const a0 = R(-0.6, 1.2); // a short stroke along the shaded underside, not a ring
      pen(Array.from({ length: 4 }, (_, k) => {
        const a = a0 + k * 0.38;
        return [x + Math.cos(a) * s, y + Math.sin(a) * s * 0.9] as Pt;
      }), 1.5, 0.42, 0.3);
    }
  }

  function forest(poly: Pt[], perArea: number, rMin: number, rMax: number, kind: "mangrove" | "village" = "mangrove") {
    const us = poly.map((p) => p[0]);
    const vs = poly.map((p) => p[1]);
    const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
    const n = Math.round(((u1 - u0) * (v1 - v0)) / 10000 * perArea);
    wash(poly, kind === "mangrove" ? "#8FA36C" : "#A9B477", 0.42, 0.3, 9);
    const pts: Pt[] = [];
    for (let k = 0; k < n * 3 && pts.length < n; k++) {
      const g: Pt = [R(u0, u1), R(v0, v1)];
      if (inside(g, poly) && !isWater(g)) pts.push(g);
    }
    pts.sort((a, b) => P(a)[1] - P(b)[1]).forEach((g) => tree(g, R(rMin, rMax), kind));
  }

  /** Light scatter across the whole ground and beyond: what thins out into the paper. */
  function scatter(n: number, avoid: Pt[][] = []) {
    const pts: Pt[] = [];
    for (let k = 0; k < n * 4 && pts.length < n; k++) {
      const g: Pt = [R(-180, 1180), R(-180, 1180)];
      const [x, y] = P(g);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const f = treeF[idx(x, y)]!;
      if (rand() > f * 0.9 || isWater(g) || avoid.some((a) => inside(g, a))) continue;
      pts.push(g);
    }
    pts.sort((a, b) => P(a)[1] - P(b)[1]).forEach((g) => (rand() < 0.7 ? tree(g, R(10, 19), "village") : tree(g, R(13, 22), "mangrove")));
  }

  function plotGround(poly: Pt[], grown = false) {
    wash(poly, grown ? "#C9C890" : PAL.mudLight, 0.45, 0.25, 2);
    const us = poly.map((p) => p[0]);
    const vs = poly.map((p) => p[1]);
    const step = grown ? 30 : 24;
    for (let u = Math.min(...us) + step / 2; u < Math.max(...us); u += step)
      for (let v = Math.min(...vs) + step / 2; v < Math.max(...vs); v += step) {
        const g: Pt = [u + R(-1.5, 1.5), v + R(-1.5, 1.5)];
        if (!inside(g, poly)) continue;
        const [x, y] = P(g);
        if (grown) {
          dab(colour, x + 3, y + 4, 9, hex("#6F7458"), 0.22);
          dab(colour, x, y, 9, PAL.saplingGrown, 0.55);
          dab(colour, x + 2.5, y + 3, 5, PAL.mangrove.shadow, 0.35);
          dab(colour, x - 2.5, y - 3, 4, PAL.mangrove.lit, 0.55);
          dab(sketch, x + 2, y + 2.5, 4.5, PAL.sketchDab, 0.38);
        } else {
          dab(colour, x + 2, y + 3, 4, hex("#8A7A55"), 0.25);
          dab(colour, x, y, 5, PAL.sapling, 0.68);
          dab(colour, x - 1.5, y - 1.5, 2.2, hex("#CFE08E"), 0.6);
          pen([[x, y + 4], [x, y - 6]], 1.4, 0.55, 0.1);
        }
      }
    meta.plots.push(poly.map(P));
  }

  function house([u, v]: Pt, w: number, d: number, h: number, roof: string) {
    const A = P([u, v]);
    const B = P([u + w, v]);
    const C = P([u + w, v + d]);
    const D = P([u, v + d]);
    const up = ([x, y]: Pt): Pt => [x, y - h];
    washScreen([[C[0] + 3, C[1] + 2], [D[0] + 3, D[1] + 2], [D[0] + 12, D[1] + 8], [C[0] + 12, C[1] + 8]], "#6C6A52", 0.25, 0, 1);
    washScreen([D, C, up(C), up(D)], PAL.wall, 0.75, 0.15, 1);
    washScreen([B, C, up(C), up(B)], PAL.wallShade, 0.8, 0.15, 1);
    washScreen([up(A), up(B), up(C), up(D)], roof, 0.82, 0.2, 1);
    const mid = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - h * 0.28];
    pen([up(A), up(B), up(C), up(D), up(A)], 1.3, 0.75, 0.05);
    pen([mid(up(A), up(D)), mid(up(B), up(C))], 1.2, 0.7, 0.05);
    pen([D, up(D)], 1, 0.6, 0.05);
    pen([C, up(C)], 1, 0.6, 0.05);
    pen([B, up(B)], 1, 0.6, 0.05);
    pen([D, C, B], 1, 0.55, 0.05);
  }

  function person(x: number, y: number) {
    dab(colour, x + 7, y + 3, 6, hex("#4A4A3A"), 0.25, null, 0.05);
    const cloth = pick(PAL.cloth);
    dab(colour, x, y - 8, 6.2, cloth, 0.9, null, 0.06);
    dab(colour, x, y - 3, 5.6, cloth, 0.9, null, 0.06);
    dab(colour, x, y - 17, 4.2, PAL.skin, 0.92, null, 0.02);
    dab(sketch, x + 1, y - 17, 3, PAL.sketchDab, 0.75, null, 0.02);
    pen([[x - 6, y - 12], [x - 6, y - 1], [x + 6, y - 1], [x + 6, y - 12]], 1.2, 0.45, 0.2);
  }
  const personG = (g: Pt) => {
    const [x, y] = P(g);
    person(x, y);
  };

  function boat([u, v]: Pt, angle: number, len: number, people = 0, canopy = true) {
    const [x, y] = P([u, v]);
    const [cx, cy] = [Math.cos(angle), Math.sin(angle)];
    const [nx, ny] = [-cy, cx];
    const half = len / 2;
    const bw = len * 0.13;
    const hull: Pt[] = [[x + cx * half, y + cy * half]];
    for (const t of [0.6, 0.2, -0.2, -0.6]) hull.push([x + cx * half * t + nx * bw, y + cy * half * t + ny * bw]);
    hull.push([x - cx * half, y - cy * half]);
    for (const t of [-0.6, -0.2, 0.2, 0.6]) hull.push([x + cx * half * t - nx * bw, y + cy * half * t - ny * bw]);
    washScreen(hull.map(([px, py]) => [px + 4, py + 4] as Pt), "#557E86", 0.3, 0, 1);
    washScreen(hull, "#7A5434", 0.88, 0.25, 0.6);
    washScreen(hull.map(([px, py]) => [x + (px - x) * 0.7, y + (py - y) * 0.6] as Pt), "#C8A777", 0.6, 0.1, 0.4);
    if (canopy) {
      const c0: Pt = [x + cx * half * 0.1, y + cy * half * 0.1];
      const can: Pt[] = [
        [c0[0] + cx * len * 0.16 + nx * bw * 0.85, c0[1] + cy * len * 0.16 + ny * bw * 0.85],
        [c0[0] - cx * len * 0.16 + nx * bw * 0.85, c0[1] - cy * len * 0.16 + ny * bw * 0.85],
        [c0[0] - cx * len * 0.16 - nx * bw * 0.85, c0[1] - cy * len * 0.16 - ny * bw * 0.85],
        [c0[0] + cx * len * 0.16 - nx * bw * 0.85, c0[1] + cy * len * 0.16 - ny * bw * 0.85],
      ];
      washScreen(can, pick(["#4F6E96", "#B8503A", "#3F7F7A", "#C9A86A"]), 0.85, 0.2, 0.5);
      pen([...can, can[0]!], 1, 0.6, 0.05);
    }
    pen([...hull, hull[0]!], 1.2, 0.75, 0.05);
    for (let k = 0; k < people; k++) person(x + cx * (k - 0.5) * len * 0.3, y + cy * (k - 0.5) * len * 0.3);
    // wake
    pen([[x - cx * half - 4, y - cy * half + 3], [x - cx * half - 26, y - cy * half + 6]], 1, 0.3, 0.3);
  }

  function ripples(poly: Pt[], n: number, along: number) {
    const us = poly.map((p) => p[0]);
    const vs = poly.map((p) => p[1]);
    for (let k = 0; k < n; k++) {
      const g: Pt = [R(Math.min(...us), Math.max(...us)), R(Math.min(...vs), Math.max(...vs))];
      if (!inside(g, poly)) continue;
      const [x, y] = P(g);
      const L = R(8, 22);
      pen([[x, y], [x + Math.cos(along) * L * 0.5, y + Math.sin(along) * L * 0.5 - 1.5], [x + Math.cos(along) * L, y + Math.sin(along) * L]], 1, 0.32, 0.35);
    }
  }

  function roots(poly: Pt[], n: number) {
    const us = poly.map((p) => p[0]);
    const vs = poly.map((p) => p[1]);
    for (let k = 0; k < n; k++) {
      const g: Pt = [R(Math.min(...us), Math.max(...us)), R(Math.min(...vs), Math.max(...vs))];
      if (!inside(g, poly) || isWater(g)) continue;
      const [x, y] = P(g);
      pen([[x, y], [x + R(-0.6, 0.6), y - R(3, 6)]], 0.9, 0.4, 0.2);
    }
  }

  function paddy(u0: number, v0: number, cols: number, rows: number, size: number) {
    for (let a = 0; a < cols; a++)
      for (let b = 0; b < rows; b++) {
        const [u, v] = [u0 + a * size + R(-4, 4), v0 + b * size * 0.8 + R(-4, 4)];
        const q: Pt[] = [[u, v], [u + size - 6, v + R(-3, 3)], [u + size - 6, v + size * 0.8 - 6], [u, v + size * 0.8 - 6]];
        wash(q, pick(PAL.paddy), 0.62, 0.35, 2);
        penG([...q, q[0]!], 1.3, 0.4, 0.25);
        for (let k = 1; k < 5; k++) penG([[u + 3, v + (k * (size * 0.8 - 6)) / 5], [u + size - 9, v + (k * (size * 0.8 - 6)) / 5]], 0.8, 0.22, 0.4);
      }
  }

  function river(centre: Pt[], w0: number, w1: number, mud = 90) {
    const banks = ribbon(centre, w0 + mud, w1 + mud);
    const r = ribbon(centre, w0, w1);
    wash([...banks.left, ...r.left.slice().reverse()], PAL.mud, 0.55, 0.3, 6);
    wash([...banks.right, ...r.right.slice().reverse()], PAL.mud, 0.55, 0.3, 6);
    wash(r.poly, PAL.water, 0.66, 0.45, 4, 1.8);
    wash(ribbon(centre, w0 * 0.42, w1 * 0.42).poly, PAL.channel, 0.3, 0.2, 7, 2);
    penG(r.left, 2, 0.62);
    penG(r.right, 2, 0.62);
    water.push(r.poly);
    ripples(r.poly, Math.round((w0 + w1) * 0.6), Math.atan2(P(centre[centre.length - 1]!)[1] - P(centre[0]!)[1], P(centre[centre.length - 1]!)[0] - P(centre[0]!)[0]));
    roots(banks.poly, Math.round((w0 + w1) * 3));
    return r;
  }

  function path(centre: Pt[], width: number) {
    const r = ribbon(centre, width, width);
    wash(r.poly, PAL.path, 0.6, 0.2, 2);
    penG(r.left, 1, 0.45, 0.3);
    penG(r.right, 1, 0.45, 0.3);
  }

  const groundAll: Pt[] = [[-200, -200], [1200, -200], [1200, 1200], [-200, 1200]];

  return {
    R,
    pick,
    meta,
    water,
    wash,
    washScreen,
    forest,
    scatter,
    plotGround,
    house,
    personG,
    boat,
    river,
    path,
    paddy,
    roots,
    ripples,
    groundAll,
    pin: (g: Pt) => meta.pins.push(P(g)),
    link: (a: Pt, b: Pt) => (meta.link = [P(a), P(b)]),
    async write(name: string) {
      const toLayer = (T: Float32Array[], extra?: Float32Array) => {
        const out = Buffer.alloc(W * H * 4);
        for (let i = 0; i < W * H; i++) {
          let t = [T[0]![i]!, T[1]![i]!, T[2]![i]!];
          if (extra) t = t.map((v, ch) => v * (1 - extra[i]! * (1 - PAL.ink[ch]!)));
          // reproduce "multiply over paper" as a plain transparent layer over that paper
          const a = Math.max(1 - t[0]!, 1 - t[1]!, 1 - t[2]!);
          out[i * 4 + 3] = Math.round(Math.min(1, a) * 255);
          if (a < 0.003) continue;
          for (let ch = 0; ch < 3; ch++) out[i * 4 + ch] = Math.round(Math.max(0, Math.min(255, PAPER[ch]! * (1 - (1 - t[ch]!) / a))));
        }
        return out;
      };
      mkdirSync(OUT, { recursive: true });
      const raw = { raw: { width: W, height: H, channels: 4 as const } };
      await sharp(toLayer(colour), raw).webp({ quality: 80, alphaQuality: 80, effort: 5 }).toFile(`${OUT}/${name}-colour.webp`);
      await sharp(toLayer(sketch, ink), raw).webp({ quality: 82, alphaQuality: 90, effort: 5 }).toFile(`${OUT}/${name}-sketch.webp`);
    },
  };
}

type Scene = ReturnType<typeof scene>;
const round = (m: Meta) => ({
  plots: m.plots.map((p) => p.map(([x, y]) => [Math.round(x), Math.round(y)])),
  pins: m.pins.map(([x, y]) => [Math.round(x), Math.round(y)]),
  ...(m.link && { link: m.link.map(([x, y]) => [Math.round(x), Math.round(y)]) }),
});

// ---- the four scenes ----------------------------------------------------------------------
const SCENES: Record<string, () => Scene> = {
  /** A planting crew at work on a mudflat plot by a tidal creek, a village beyond. */
  capture() {
    const s = scene(101, { cu: 500, cv: 500, ru: 600, rv: 580 });
    s.wash(s.groundAll, PAL.marsh, 0.28, 0.1, 10);
    s.wash([[-60, 520], [520, 560], [600, 1060], [-60, 1060]], PAL.grass, 0.38, 0.25, 9);
    s.paddy(20, 700, 3, 3, 130);
    s.river([[-200, 250], [120, 320], [380, 420], [620, 390], [840, 450], [1200, 520]], 150, 190, 110);
    s.path([[360, 1080], [460, 860], [600, 790], [800, 830], [1000, 780]], 26);
    s.forest([[-60, -60], [1060, -60], [1060, 330], [820, 300], [560, 270], [300, 300], [60, 200], [-60, 180]], 4.2, 15, 26);
    const plot: Pt[] = [[380, 540], [660, 552], [648, 720], [372, 706]];
    s.plotGround(plot);
    [[430, 590], [500, 640], [580, 600], [460, 680], [610, 690], [540, 560]].forEach((g) => s.personG(g as Pt));
    s.boat([520, 470], 0.5, 130, 1);
    s.boat([800, 455], 0.55, 104, 1, false);
    [[690, 740], [790, 780], [880, 720], [740, 860], [870, 840]].forEach(([u, v]) => s.house([u!, v!], 64, 48, 30, s.pick(PAL.roofs)));
    s.forest([[660, 690], [980, 660], [1000, 940], [680, 940]], 1.4, 12, 20, "village");
    [[740, 820], [850, 800]].forEach((g) => s.personG(g as Pt));
    s.scatter(320, [plot]);
    s.pin([470, 615]);
    s.pin([600, 670]);
    return s;
  },
  /** One photograph, two plots on opposite banks of a wide river, run by different organisations. */
  check() {
    const s = scene(202, { cu: 500, cv: 500, ru: 600, rv: 600 });
    s.wash(s.groundAll, PAL.marsh, 0.28, 0.1, 10);
    s.river([[-200, 400], [200, 460], [500, 510], [780, 480], [1200, 560]], 260, 300, 130);
    s.forest([[-60, -60], [1060, -60], [1060, 360], [700, 340], [380, 360], [80, 300], [-60, 280]], 4.2, 15, 26);
    s.forest([[620, 680], [1060, 660], [1060, 1060], [640, 1060]], 3.6, 14, 24);
    const a: Pt[] = [[200, 200], [400, 210], [392, 330], [192, 318]];
    const b: Pt[] = [[400, 700], [600, 712], [590, 850], [394, 838]];
    s.plotGround(a);
    s.plotGround(b);
    s.paddy(-10, 700, 3, 2, 130);
    [[200, 920], [300, 960], [120, 1000], [380, 900]].forEach(([u, v]) => s.house([u!, v!], 62, 48, 28, s.pick(PAL.roofs)));
    s.boat([360, 490], 0.45, 130, 2);
    s.boat([650, 510], 0.5, 104, 1, false);
    s.boat([900, 560], 0.45, 118, 1);
    [[260, 250], [340, 290], [450, 760], [540, 800], [250, 880]].forEach((g) => s.personG(g as Pt));
    s.scatter(320, [a, b]);
    s.pin([300, 265]);
    s.pin([495, 775]);
    s.link([300, 265], [495, 775]);
    return s;
  },
  /** A grown plot in the mangrove forest, a forest station and jetty, reviewers on site. */
  review() {
    const s = scene(303, { cu: 500, cv: 500, ru: 590, rv: 590 });
    s.wash(s.groundAll, PAL.mud, 0.26, 0.1, 10);
    s.river([[1200, 160], [840, 300], [660, 430], [580, 640], [380, 840], [-200, 920]], 120, 150, 90);
    s.forest([[-60, -60], [1060, -60], [1060, 180], [780, 300], [620, 410], [420, 360], [-60, 360]], 4.4, 15, 27);
    s.forest([[-60, 360], [330, 370], [360, 620], [280, 780], [-60, 820]], 4.2, 15, 26);
    s.forest([[720, 520], [1060, 360], [1060, 1060], [520, 1060], [540, 780]], 4.2, 15, 26);
    const plot: Pt[] = [[360, 400], [580, 420], [540, 640], [340, 620]];
    s.plotGround(plot, true);
    s.house([660, 660], 86, 64, 38, "#7F93A0");
    s.wash([[594, 672], [660, 680], [654, 700], [588, 692]], "#B08A5C", 0.85, 0.2, 0.5); // the jetty
    s.boat([560, 700], 1.15, 116, 1);
    [[420, 470], [470, 560], [690, 760], [740, 740]].forEach((g) => s.personG(g as Pt));
    s.scatter(260, [plot]);
    s.pin([430, 500]);
    s.pin([500, 590]);
    return s;
  },
  /** Where the forest meets the Bay of Bengal: beach, surf, fishing boats, a coastal plot. */
  verify() {
    const s = scene(404, { cu: 520, cv: 500, ru: 620, rv: 600 });
    const coast: Pt[] = [[540, -200], [600, 120], [560, 360], [680, 600], [640, 820], [760, 1200]];
    s.wash([[-200, -200], ...coast.map(([u, v]) => [u + 40, v] as Pt), [-200, 1200]], PAL.marsh, 0.28, 0.1, 10); // land only
    const sea: Pt[] = [...coast, [1300, 1200], [1300, -200]];
    // the beach is a strip along the shore; the sea is painted on clean paper, so it stays blue
    s.wash([...coast.map(([u, v]) => [u + 20, v] as Pt), ...coast.map(([u, v]) => [u + 100, v] as Pt).reverse()], PAL.sand, 0.62, 0.3, 6);
    s.wash(sea.map(([u, v]) => [u + 90, v] as Pt), PAL.sea, 0.7, 0.35, 6, 1.8);
    s.wash(sea.map(([u, v]) => [u + 280, v] as Pt), PAL.seaDeep, 0.38, 0.2, 9, 2.2);
    s.water.push(sea.map(([u, v]) => [u + 80, v] as Pt));
    s.ripples(sea.map(([u, v]) => [u + 120, v] as Pt), 220, 0.5);
    s.river([[-200, 500], [150, 470], [360, 420], [640, 400]], 100, 150, 80);
    s.forest([[-60, -60], [560, -60], [600, 120], [560, 360], [300, 380], [-60, 420]], 4.2, 15, 26);
    s.forest([[-60, 580], [360, 580], [560, 720], [600, 1060], [-60, 1060]], 3.2, 13, 24);
    const plot: Pt[] = [[390, 470], [570, 478], [590, 610], [408, 610]];
    s.plotGround(plot);
    [[130, 700], [230, 750], [320, 690], [170, 830]].forEach(([u, v]) => s.house([u!, v!], 62, 48, 28, s.pick(PAL.roofs)));
    s.boat([860, 340], 0.6, 130, 2);
    s.boat([960, 610], 0.5, 112, 1);
    s.boat([820, 830], 0.55, 104, 2, false);
    s.boat([1000, 220], 0.45, 98, 1);
    [[450, 520], [520, 570], [700, 640]].forEach((g) => s.personG(g as Pt));
    s.scatter(300, [plot]);
    s.pin([480, 540]);
    s.pin([860, 340]);
    return s;
  },
};

async function main() {
  const meta: Record<string, ReturnType<typeof round>> = {};
  for (const [name, build] of Object.entries(SCENES)) {
    const t0 = Date.now();
    const s = build();
    await s.write(name);
    meta[name] = round(s.meta);
    console.log(`painted ${name} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  writeFileSync(META, `${JSON.stringify({ width: W, height: H, scenes: meta }, null, 1)}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
