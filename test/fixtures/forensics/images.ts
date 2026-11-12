// The forensics fixture set (docs/10-FORENSICS.md §8): deterministic images built in code, so
// the set is reviewable as text and regenerates byte-for-byte. The real photographs it derives
// from are the three licensed life photos already in public/images/life (credits.json).
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { mulberry32 } from "../../../scripts/lib/seed-pool";

export const LIFE = {
  kingfisher: "public/images/life/collared-kingfisher-perched-on-mangrove-tree.jpg",
  deer: "public/images/life/spotted-deer-grazing-in-sundarbans-mangrove-forest.jpg",
  honey: "public/images/life/the-last-honey-hunters-of-the-sundarbans.jpg",
} as const;

export const photo = (name: keyof typeof LIFE) => readFile(LIFE[name]);

/** A blocky synthetic photo, unique per seed and far (Hamming) from the seed pool's. */
export async function synthetic(seed: number, quality = 85): Promise<Buffer> {
  const r = mulberry32(seed);
  const [W, H, B] = [120, 90, 10];
  const raw = Buffer.alloc(W * H * 3);
  const blocks = Array.from({ length: (W / B) * (H / B) }, () => [r() * 255, r() * 255, r() * 255]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 3; c++) raw[(y * W + x) * 3 + c] = Math.round(blocks[Math.floor(y / B) * (W / B) + Math.floor(x / B)]![c]!);
  return sharp(raw, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality }).toBuffer();
}

/** The labelled variants the eval runs: what each does to the photograph. */
export const VARIANTS = {
  "resized 50%": async (b: Buffer) => {
    const { width = 0 } = await sharp(b).metadata();
    return sharp(b).resize({ width: Math.round(width / 2) }).jpeg({ quality: 90 }).toBuffer();
  },
  "re-compressed q60": (b: Buffer) => sharp(b).jpeg({ quality: 60 }).toBuffer(),
  "cropped 10%": (b: Buffer) => crop(b, 0.1),
  "cropped 40%": (b: Buffer) => crop(b, 0.4),
  "rotated 90°": (b: Buffer) => sharp(b).rotate(90).jpeg({ quality: 90 }).toBuffer(),
} as const;

/** Removes `fraction` of the area, centred: each side keeps √(1 − fraction) of its length. */
async function crop(b: Buffer, fraction: number) {
  const { width = 0, height = 0 } = await sharp(b).metadata();
  const keep = Math.sqrt(1 - fraction);
  const [dw, dh] = [Math.round((width * (1 - keep)) / 2), Math.round((height * (1 - keep)) / 2)];
  return sharp(b).extract({ left: dw, top: dh, width: width - 2 * dw, height: height - 2 * dh }).jpeg({ quality: 90 }).toBuffer();
}
