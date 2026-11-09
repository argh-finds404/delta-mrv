import type { CSSProperties, ReactNode } from "react";

// The hero's painting: one wide watercolour of the Sundarbans landscape, plains to the sea. The
// camera pans across it, one region per step of a claim (felt.com's hero), while it paints itself
// in (sketch, then colour) and keeps living in slow motion: clouds drift, water shimmers, birds
// cross, the boat bobs, reeds sway, village smoke rises. Original art, deterministic, no images.
// Timing lives in globals.css (.ls-*); with reduced motion it is a still painting.

export const PANO = { w: 3200, h: 760 };
/** How much of the panorama the 10:7 frame shows at once. */
export const WINDOW = Math.round((PANO.h * 10) / 7);

type Pt = [number, number];

const C = {
  ink: "#3A3027",
  sky: "#C5DBE0",
  haze: "#EEDFC2",
  cloud: "#E3EBEB",
  cloudShade: "#C6D4D6",
  farLand: "#9FB4A6",
  forest: "#5C7A4C",
  forestDark: "#46613D",
  forestLit: "#88A462",
  water: "#A3C5C9",
  waterDeep: "#7EAAB2",
  shimmer: "#ECF3F1",
  field: ["#DCC687", "#C7D28A", "#B2C676", "#E6D59E", "#CFC27E"],
  path: "#CDB487",
  wall: "#D3AA7E",
  roof: "#A9713F",
  roofShade: "#8D5A31",
  marsh: "#BDC89C",
  pool: "#9DC1C2",
  reed: "#7C8F4E",
  reedLit: "#A0AE68",
  mud: "#CBB48C",
  canopy: ["#4E7342", "#678B4C", "#86A25D"],
  trunk: "#5B4A3A",
  sapling: "#7EA151",
  sand: "#E8D6A8",
  sea: "#8CB9C1",
  seaDeep: "#6C9DAC",
  foam: "#F4F1E6",
  hull: "#6A4A33",
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
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Catmull-Rom through the points, as cubic Béziers. */
function smooth(pts: Pt[], closed = false): string {
  const n = pts.length;
  const at = (i: number) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))]!;
  let d = `M${r1(pts[0]![0])} ${r1(pts[0]![1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += `C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}
const circle = ([cx, cy]: Pt, r: number) => `M${r1(cx - r)} ${r1(cy)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0`;
const ellipse = ([cx, cy]: Pt, rx: number, ry: number) => `M${r1(cx - rx)} ${r1(cy)}a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(2 * rx)} 0a${r1(rx)} ${r1(ry)} 0 1 0 ${r1(-2 * rx)} 0`;

/** A ragged band: a wobbling top edge from x0 to x1, closed down to the bottom. */
function band(rand: () => number, x0: number, x1: number, top: number, amp: number, step: number, bottom: number): string {
  const pts: Pt[] = [];
  for (let x = x0; x <= x1; x += step) pts.push([x, top + (rand() - 0.5) * amp]);
  return `${smooth(pts)}L${x1} ${bottom}L${x0} ${bottom}Z`;
}

/** Collects many shapes of one paint into one path: a layer is a few paths, not thousands. */
class Palette {
  private layers = new Map<string, string[]>();
  add(color: string, d: string) {
    this.layers.set(color, [...(this.layers.get(color) ?? []), d]);
  }
  render(opacity: number, key: string) {
    return [...this.layers].map(([color, ds], i) => <path key={`${key}-${i}`} d={ds.join("")} fill={color} opacity={opacity} />);
  }
}

function paint() {
  const rand = mulberry32(20261111);
  const R = (a: number, b: number) => a + rand() * (b - a);
  const ink: string[] = [];
  const lightInk: string[] = [];

  // ---- sky, clouds, the far shore -------------------------------------------------------
  const sky = new Palette();
  sky.add(C.sky, band(rand, -40, PANO.w + 40, 10, 40, 160, 260));
  sky.add(C.haze, band(rand, -40, PANO.w + 40, 210, 30, 140, 330));
  const clouds: ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const cx = R(80, PANO.w - 80);
    const cy = R(55, 170);
    const puffs = Array.from({ length: 5 }, (_, k) => ellipse([cx + (k - 2) * R(26, 40), cy + R(-10, 8)], R(34, 60), R(16, 26))).join("");
    clouds.push(
      <g key={`cloud${i}`} className="ls-cloud" style={{ "--d": `${R(60, 110)}s`, "--x": `${R(30, 70)}px` } as CSSProperties}>
        <path d={puffs} fill={C.cloud} opacity={0.85} />
        <path d={ellipse([cx, cy + 14], R(80, 120), 10)} fill={C.cloudShade} opacity={0.5} />
      </g>,
    );
  }
  const far = new Palette();
  far.add(C.farLand, `${band(rand, -40, 2560, 292, 14, 90, 330).replace(/L2560 330L-40 330Z$/, "")}C2600 318 2620 326 2640 330L-40 330Z`);

  // ---- the forest line along the far bank --------------------------------------------------
  const forest = new Palette();
  const crownLine: Pt[] = [];
  for (let x = -20; x <= 2560; x += 13) crownLine.push([x, 312 - R(10, 42) * (x > 2380 ? Math.max(0, (2560 - x) / 180) : 1)]);
  forest.add(C.forest, `${smooth(crownLine)}L2560 340C2520 350 2480 352 2440 352L-20 352Z`);
  for (let x = 0; x < 2500; x += R(18, 34)) forest.add(C.forestDark, ellipse([x, R(318, 334)], R(14, 26), R(9, 15)));
  for (let x = 0; x < 2500; x += R(24, 48)) forest.add(C.forestLit, ellipse([x, R(282, 300)], R(8, 14), R(5, 8)));
  ink.push(smooth(crownLine));

  // ---- the estuary ------------------------------------------------------------------------
  const water = new Palette();
  water.add(C.water, band(rand, -40, PANO.w + 40, 342, 6, 200, 500));
  water.add(C.waterDeep, `M2620 292C2540 330 2470 420 2400 522L${PANO.w + 40} 522L${PANO.w + 40} 288Z`); // the open sea, curving into the river mouth
  for (let x = 0; x < 2500; x += R(40, 90)) water.add(C.forestDark, ellipse([x, R(352, 362)], R(20, 50), 3)); // reflection
  const shimmer: string[] = [];
  for (let i = 0; i < 140; i++) {
    const [x, y] = [R(0, PANO.w), R(365, 490)];
    shimmer.push(`M${r1(x)} ${r1(y)}h${r1(R(10, 34))}`);
  }

  // ---- the near bank: plains | marsh | mangrove | coast ----------------------------------
  const land = new Palette();
  const near = band(rand, -40, PANO.w + 40, 470, 24, 110, PANO.h + 20);
  land.add(C.mud, near);
  ink.push(near.slice(0, near.indexOf("L")));

  // plains (0–820): fields in perspective, a dyke path, a village, palms
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 5; col++) {
      const y0 = 500 + row * 70;
      const x0 = -20 + col * 170 + row * 18;
      const w = 160;
      const d = smooth([[x0, y0], [x0 + w, y0 + 6], [x0 + w + 22, y0 + 64], [x0 + 18, y0 + 60]], true);
      land.add(C.field[(row * 5 + col) % C.field.length]!, d);
      lightInk.push(d);
      for (let k = 1; k < 6; k++) lightInk.push(`M${r1(x0 + 6 + k * 3)} ${r1(y0 + (k * 60) / 6)}h${r1(w - 10)}`); // crop rows
    }
  ink.push(smooth([[-20, 488], [220, 482], [470, 490], [760, 484], [860, 492]]));
  const huts: ReactNode[] = [];
  const smoke: ReactNode[] = [];
  [[150, 470], [260, 476], [560, 468], [690, 474]].forEach(([hx, hy], i) => {
    const w = R(46, 60);
    const wall = `M${hx} ${hy}h${r1(w)}v-26h${r1(-w)}Z`;
    const roof = `M${hx - 8} ${hy - 24}L${r1(hx + w / 2)} ${hy - 58}L${r1(hx + w + 8)} ${hy - 24}Z`;
    huts.push(
      <g key={`hut${i}`}>
        <path d={wall} fill={C.wall} />
        <path d={roof} fill={C.roof} />
        <path d={`M${r1(hx + w / 2)} ${hy - 58}L${r1(hx + w + 8)} ${hy - 24}H${r1(hx + w / 2)}Z`} fill={C.roofShade} opacity={0.6} />
        <path d={`M${r1(hx + w * 0.4)} ${hy}v-14h9v14`} fill={C.roofShade} opacity={0.7} />
      </g>,
    );
    ink.push(wall, roof);
    if (i % 2 === 0) smoke.push(<path key={`smoke${i}`} className="ls-smoke" d={smooth([[hx + w / 2, hy - 60], [hx + w / 2 + 6, hy - 90], [hx + w / 2 - 4, hy - 120], [hx + w / 2 + 8, hy - 150]])} fill="none" stroke="#B9B5AA" strokeWidth={6} strokeLinecap="round" opacity={0.5} />);
  });
  const palms: string[] = [];
  [[90, 486], [420, 480], [790, 488]].forEach(([px, py]) => {
    const top: Pt = [px + R(-14, 14), py - R(110, 140)];
    palms.push(smooth([[px, py], [px + 4, py - 60], top]));
    for (let f = 0; f < 7; f++) {
      const a = -Math.PI / 2 + (f - 3) * 0.55;
      palms.push(smooth([top, [top[0] + Math.cos(a) * 30, top[1] + Math.sin(a) * 18], [top[0] + Math.cos(a) * 56, top[1] + Math.sin(a) * 6 + 22]]));
    }
  });

  // marsh (820–1620): wet ground, pools, reed beds, egrets
  land.add(C.marsh, band(rand, 820, 1640, 486, 18, 80, PANO.h + 20));
  for (let i = 0; i < 7; i++) {
    const d = smooth(Array.from({ length: 8 }, (_, k) => {
      const a = (k / 8) * Math.PI * 2;
      const [cx, cy] = [880 + i * 108 + R(-20, 20), R(540, 690)];
      return [cx + Math.cos(a) * 58 * R(0.85, 1.1), cy + Math.sin(a) * 18 * R(0.85, 1.1)] as Pt;
    }), true);
    land.add(C.pool, d);
    lightInk.push(d);
  }
  const reeds: ReactNode[] = [];
  for (let g = 0; g < 22; g++) {
    const [bx, by] = [R(830, 1620), R(500, 730)];
    const blades = Array.from({ length: 9 }, () => {
      const x = bx + R(-16, 16);
      return `M${r1(x)} ${r1(by)}q${r1(R(-6, 6))} ${r1(-R(18, 30))} ${r1(R(-10, 10))} ${r1(-R(36, 62))}`;
    }).join("");
    reeds.push(<path key={`reed${g}`} className="ls-sway" style={{ "--d": `${R(4.5, 7)}s`, transformOrigin: `${r1(bx)}px ${r1(by)}px` } as CSSProperties} d={blades} fill="none" stroke={g % 3 ? C.reed : C.reedLit} strokeWidth={2.2} strokeLinecap="round" />);
  }
  const egrets: ReactNode[] = [[1010, 600], [1190, 640], [1420, 585]].map(([x, y], i) => (
    <g key={`egret${i}`} className="ls-egret" style={{ "--d": `${6 + i}s` } as CSSProperties}>
      <path d={`${ellipse([x!, y!], 13, 7)}`} fill="#FBFAF5" />
      <path d={`M${x! + 9} ${y! - 3}q8 -12 2 -22q-4 -6 4 -8l9 3`} fill="none" stroke="#FBFAF5" strokeWidth={4} strokeLinecap="round" />
      <path d={`M${x! - 2} ${y! + 6}v18M${x! + 4} ${y! + 6}v18`} stroke={C.ink} strokeWidth={1.3} />
    </g>
  ));

  // mangrove (1620–2420): the restoration site: mud, roots, big trees, a sapling plot
  const mangrove = new Palette();
  land.add(C.mud, band(rand, 1620, 2440, 478, 16, 80, PANO.h + 20));
  const roots: string[] = [];
  for (let i = 0; i < 260; i++) {
    const [x, y] = [R(1630, 2420), R(560, 740)];
    roots.push(`M${r1(x)} ${r1(y)}l${r1(R(-1, 1))} ${r1(-R(6, 13))}`); // pneumatophores
  }
  [[1690, 520, 1.1], [1820, 540, 1.3], [2150, 525, 1.2], [2330, 540, 1.0]].forEach(([tx, ty, s]) => {
    for (let k = 0; k < 11; k++) {
      const p: Pt = [tx! + R(-64, 64) * s!, ty! - 70 * s! - R(0, 54) * s!];
      const cr = R(22, 38) * s!;
      mangrove.add("#3F5F38", circle([p[0] + cr * 0.25, p[1] + cr * 0.3], cr * 0.9));
      mangrove.add(C.canopy[k % 3]!, circle(p, cr));
      mangrove.add("#A3BC72", circle([p[0] - cr * 0.3, p[1] - cr * 0.35], cr * 0.35));
      if (k % 2 === 0) ink.push(smooth([[p[0] - cr, p[1] + 2], [p[0] - cr * 0.6, p[1] - cr * 0.8], [p[0] + cr * 0.3, p[1] - cr], [p[0] + cr, p[1] - cr * 0.2]]));
    }
    for (let k = 0; k < 7; k++) {
      const rx = tx! + (k - 3) * 16 * s!;
      roots.push(smooth([[tx! + R(-8, 8), ty! - 46 * s!], [rx, ty! - 22 * s!], [rx + R(-10, 10), ty! + 8]])); // prop roots arching to the mud
    }
    roots.push(`M${r1(tx!)} ${r1(ty! - 40 * s!)}v${r1(-34 * s!)}`); // the trunk
  });
  const saplings: string[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 14; col++) {
      const [x, y] = [1930 + col * 15 + row * 6, 600 + row * 20];
      saplings.push(ellipse([x, y - 6], 4.5, 6));
      lightInk.push(`M${x} ${y}v-12`);
    }

  // coast (2420–3200): sand bar, surf, the sea, boats and the people in them
  land.add(C.sand, band(rand, 2440, PANO.w + 40, 512, 20, 90, PANO.h + 20));
  const waves: string[] = [];
  for (let i = 0; i < 46; i++) {
    const [x, y] = [R(2440, PANO.w), R(400, 505)];
    waves.push(`M${r1(x)} ${r1(y)}q12 -6 24 0q12 6 24 0`);
  }
  const boat = (x: number, y: number, s: number, people: string[]) => (
    <g>
      <path d={`M${x - 70 * s} ${y}q70 ${26 * s} 140 0l-14 ${14 * s}h${-112 * s}Z`} fill={C.hull} />
      {people.map((color, k) => (
        <g key={k}>
          <path d={ellipse([x - 30 * s + k * 26 * s, y - 16 * s], 6 * s, 11 * s)} fill={color} />
          <path d={circle([x - 30 * s + k * 26 * s, y - 31 * s], 4.5 * s)} fill="#6B4A36" />
        </g>
      ))}
      <path d={`M${x + 40 * s} ${y - 6 * s}l${34 * s} ${-44 * s}`} stroke={C.ink} strokeWidth={2} />
    </g>
  );

  // foreground: darker grass tufts along the bottom, the way a painter frames a view
  const tufts: string[] = [];
  for (let x = 0; x < PANO.w; x += R(14, 30)) {
    const y = PANO.h - R(4, 22);
    tufts.push(`M${r1(x)} ${r1(y + 14)}q${r1(R(-3, 3))} -10 ${r1(R(-6, 6))} -${r1(R(14, 28))}`);
  }

  return {
    sky: sky.render(0.75, "sky"),
    far: far.render(0.6, "far"),
    forest: forest.render(0.95, "forest"),
    water: water.render(0.82, "water"),
    land: land.render(0.9, "land"),
    mangrove: mangrove.render(0.92, "mangrove"),
    clouds,
    huts,
    smoke,
    reeds,
    egrets,
    ink: ink.join(""),
    lightInk: lightInk.join(""),
    palms: palms.join(""),
    roots: roots.join(""),
    saplings: saplings.join(""),
    shimmer: shimmer.join(""),
    waves: waves.join(""),
    tufts: tufts.join(""),
    boats: (
      <>
        <g className="ls-boat" style={{ "--d": "4.6s" } as CSSProperties}>{boat(2760, 452, 1.15, ["#B5533C", "#4D6E9B", "#E8E2D2"])}</g>
        <g className="ls-boat" style={{ "--d": "5.8s" } as CSSProperties}>{boat(3060, 420, 0.7, ["#D9B44A", "#B5533C"])}</g>
        <g className="ls-boat" style={{ "--d": "5.2s" } as CSSProperties}>{boat(1250, 420, 0.75, ["#4D6E9B", "#E8E2D2"])}</g>
      </>
    ),
  };
}

const art = paint();

/** The painting, panned to `pan` (an x in panorama units), with every scene's overlays drawn on it. */
export function Landscape({ pan, overlays, active }: { pan: number; overlays: ReactNode[]; active: number }) {
  const left = Math.max(0, Math.min(PANO.w - WINDOW, pan - WINDOW / 2));
  return (
    <div
      className="ls-pan absolute inset-y-0 left-0"
      style={{ width: `${(PANO.w / WINDOW) * 100}%`, transform: `translateX(${-(left / PANO.w) * 100}%)` }}
    >
      <svg viewBox={`0 0 ${PANO.w} ${PANO.h}`} preserveAspectRatio="xMinYMid slice" className="h-full w-full" role="img" aria-label="A watercolour of the Sundarbans: village fields, marsh, mangrove forest and the sea">
        <defs>
          {/* wet edges: displaced, softened, darker where the pigment dried */}
          <filter id="ls-wash" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="4" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" result="bled" />
            <feGaussianBlur in="bled" stdDeviation="0.8" result="soft" />
            <feMorphology in="soft" operator="erode" radius="2.5" result="core" />
            <feComposite in="soft" in2="core" operator="out" result="rim" />
            <feColorMatrix in="rim" values="0.55 0 0 0 0  0 0.55 0 0 0  0 0 0.55 0 0  0 0 0 0.45 0" result="dark" />
            <feMerge>
              <feMergeNode in="soft" />
              <feMergeNode in="dark" />
            </feMerge>
          </filter>
          <filter id="ls-pen" x="-2%" y="-2%" width="104%" height="104%">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="ls-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" />
            <feColorMatrix values="0 0 0 0 0.36  0 0 0 0 0.3  0 0 0 0 0.22  0 0 0 0.5 -0.1" />
          </filter>
        </defs>

        {/* colour, layer by layer, the order a painter lays washes */}
        <g className="ls-wash" style={{ "--i": 0 } as CSSProperties} filter="url(#ls-wash)">{art.sky}</g>
        <g className="ls-wash ls-sky" style={{ "--i": 1 } as CSSProperties}>{art.clouds}</g>
        <g className="ls-wash" style={{ "--i": 2 } as CSSProperties} filter="url(#ls-wash)">
          {art.far}
          {art.forest}
        </g>
        <g className="ls-wash" style={{ "--i": 3 } as CSSProperties} filter="url(#ls-wash)">{art.water}</g>
        <g className="ls-wash" style={{ "--i": 4 } as CSSProperties} filter="url(#ls-wash)">
          {art.land}
          {art.mangrove}
        </g>
        <g className="ls-wash" style={{ "--i": 5 } as CSSProperties}>
          <path d={art.saplings} fill={C.sapling} />
          {art.huts}
        </g>

        {/* the pen: drawn first, so the sketch shows before the colour */}
        <g className="ls-ink" filter="url(#ls-pen)" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={art.ink} stroke={C.ink} strokeWidth={1.6} opacity={0.75} pathLength={1} />
          <path d={art.lightInk} stroke={C.ink} strokeWidth={0.9} opacity={0.4} pathLength={1} />
          <path d={art.palms} stroke="#4E5E35" strokeWidth={3} opacity={0.9} pathLength={1} />
          <path d={art.roots} stroke={C.trunk} strokeWidth={2} opacity={0.75} pathLength={1} />
          <path d={art.tufts} stroke="#6D7A45" strokeWidth={2.4} opacity={0.8} pathLength={1} />
        </g>

        {/* the living layer: everything that keeps moving, slowly */}
        <g className="ls-life">
          <path className="ls-shimmer" d={art.shimmer} stroke={C.shimmer} strokeWidth={2.2} strokeLinecap="round" />
          <path className="ls-shimmer ls-shimmer-b" d={art.waves} fill="none" stroke={C.foam} strokeWidth={2} strokeLinecap="round" />
          {art.smoke}
          {art.reeds}
          {art.egrets}
          {art.boats}
          <g className="ls-birds">
            {[0, 1, 2, 3].map((k) => (
              <path key={k} className="ls-bird" style={{ "--k": k } as CSSProperties} d={`M${200 + k * 34} ${120 + (k % 2) * 16}q10 -9 18 0q8 -9 18 0`} fill="none" stroke={C.ink} strokeWidth={2} strokeLinecap="round" />
            ))}
          </g>
        </g>

        <rect width={PANO.w} height={PANO.h} filter="url(#ls-grain)" style={{ mixBlendMode: "multiply" }} opacity={0.6} />

        {/* each step's annotations, shown only while that step is active */}
        {overlays.map((o, i) => (
          <g key={i} className="hero-scene" data-active={i === active || undefined} aria-hidden={i !== active}>
            {o}
          </g>
        ))}
      </svg>
    </div>
  );
}
