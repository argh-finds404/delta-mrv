// docs/16-AMENDMENTS-v2.md A10: every colour used as text reaches WCAG AA (4.5:1) on every
// surface it sits on, including its own 14% badge tint, and white reaches it on every fill.
// The values are read from globals.css, so editing a token re-runs the check.
// If this goes red, fix the token. Never the threshold.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STATUS_META } from "../src/lib/status";

const css = readFileSync("src/app/globals.css", "utf8");
const root = css.slice(0, css.indexOf('[data-theme="paper"]'));
const hex = (name: string) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(root);
  if (!m) throw new Error(`globals.css has no hex token --${name}`);
  return m[1]!;
};
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const luminance = (h: string) => {
  const [r, g, b] = rgb(h).map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
/** `fg` at `share` over `bg`: a badge tint (docs/18: 14%). */
const tint = (fg: string, bg: string, share = 0.14) => `#${rgb(fg).map((c, i) => Math.round(c * share + rgb(bg)[i]! * (1 - share)).toString(16).padStart(2, "0")).join("")}`;

const FIELD = ["field-abyss", "field-canopy", "field-raised"];
const PAPER = ["paper", "paper-card"];
const PAPER_RAISED = "#EFE9DC"; // --theme-surface-raised on Paper
const STATE = ["verified", "chain", "review", "fraud"]; // drawn on both themes

const pairs: [text: string, on: string, fg: string, bg: string][] = [];
const add = (text: string, surfaces: string[], tinted: boolean) => {
  for (const s of surfaces) {
    pairs.push([text, s, hex(text), hex(s)]);
    if (tinted) pairs.push([text, `its own tint on ${s}`, hex(text), tint(hex(text), hex(s))]);
  }
};
for (const t of ["field-text", "field-muted"]) add(t, FIELD, false);
for (const t of ["signal", ...STATE]) add(t, FIELD, true);
for (const t of ["paper-ink", "paper-muted"]) add(t, PAPER, false);
for (const t of ["paper-seal", "paper-chain", ...STATE]) add(t, PAPER, true);
for (const t of ["paper-ink", "paper-muted", "paper-seal", "paper-chain", ...STATE]) pairs.push([t, "paper raised", hex(t), PAPER_RAISED]);
for (const fill of ["signal", "verified", "verified-fill", "chain", "review", "fraud", "paper-seal", "paper-chain"]) pairs.push(["white", fill, "#FFFFFF", hex(fill)]);

// the workspace status badge: its hue as text on an 11% tint of itself over white (status-badge.tsx)
for (const [status, { color }] of Object.entries(STATUS_META)) pairs.push([`status ${status}`, "its own badge", color, tint(color, "#FFFFFF", 0.11)]);

describe("colour contrast (A10)", () => {
  it.each(pairs)("%s on %s is at least 4.5:1", (_text, _on, fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
