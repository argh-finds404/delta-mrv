// claims.v1: a project's claimed number against its own registered boundary. An area claim larger
// than the area drawn, or more plants per square metre than any planting method uses, is a MEDIUM
// finding; an ordinary claim is an INFO finding with its arithmetic. Pure and deterministic: the
// claim and the boundary cannot change once evidence exists, so a replay gets the same text.
// It reads the organisation's own number; it never says whether the plants exist.

export const CLAIMS_RULE_VERSION = "claims.v1";
/** A claimed area may exceed the drawn one by this factor before it is flagged: corners are placed by hand. */
export const AREA_TOLERANCE = 1.05;
/** The densest common method (Miyawaki-style dense planting) uses about 3 to 5 plants per square metre. */
export const MAX_PLANTS_PER_M2 = 5;

const AREA_UNITS: [RegExp, number, string][] = [
  [/^(ha|hectares?)$/, 10_000, "hectares"],
  [/^(ac|acres?)$/, 4_046.856_422_4, "acres"],
  [/^(km2|km²|sq\.? ?km|square kilomet(er|re)s?)$/, 1_000_000, "square kilometres"],
  [/^(m2|m²|sq\.? ?m|square met(er|re)s?)$/, 1, "square metres"],
];
const PLANTS = /\b(saplings?|seedlings?|trees?|plants?|propagules?|shrubs?|stems?|mangroves?)\b/;

export type UnitKind = { kind: "area"; m2PerUnit: number; name: string } | { kind: "plants" };

export function unitKind(unit: string | null | undefined): UnitKind | null {
  const u = (unit ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!u) return null;
  for (const [re, m2PerUnit, name] of AREA_UNITS) if (re.test(u)) return { kind: "area", m2PerUnit, name };
  return PLANTS.test(u) ? { kind: "plants" } : null;
}

export type ClaimCheck =
  | { kind: "none" }
  | { kind: "area"; claimed: number; unitName: string; claimedM2: number; boundaryM2: number; ratio: number; exceeds: boolean }
  | { kind: "plants"; plants: number; unit: string; boundaryM2: number; perHectare: number; perSquareMetre: number; implausible: boolean };

export function checkClaim(quantity: number | null | undefined, unit: string | null | undefined, boundaryM2: number): ClaimCheck {
  const kind = unitKind(unit);
  if (!kind || quantity === null || quantity === undefined || !(quantity > 0) || !(boundaryM2 > 0)) return { kind: "none" };
  if (kind.kind === "area") {
    const claimedM2 = quantity * kind.m2PerUnit;
    const ratio = claimedM2 / boundaryM2;
    return { kind: "area", claimed: quantity, unitName: kind.name, claimedM2, boundaryM2, ratio, exceeds: ratio > AREA_TOLERANCE };
  }
  const perSquareMetre = quantity / boundaryM2;
  return { kind: "plants", plants: quantity, unit: unit!.trim(), boundaryM2, perHectare: perSquareMetre * 10_000, perSquareMetre, implausible: perSquareMetre > MAX_PLANTS_PER_M2 };
}

/** Digits grouped with commas, at most `max` decimals, trailing zeros dropped: stable across runtimes. */
function num(n: number, max = 0): string {
  const fixed = max > 0 ? n.toFixed(max).replace(/\.?0+$/, "") : n.toFixed(0);
  const [whole, frac] = fixed.split(".") as [string, string?];
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac ? `.${frac}` : "");
}
const hectares = (m2: number) => {
  const ha = m2 / 10_000;
  return `${num(ha, ha >= 100 ? 0 : ha >= 10 ? 1 : 2)} hectares`;
};

export type ClaimFinding = { kind: "CLAIM_CHECKED" | "CLAIM_EXCEEDS_AREA" | "CLAIM_DENSITY_IMPLAUSIBLE"; severity: "INFO" | "MEDIUM"; reason: string; evidence: Record<string, unknown> };

/** The finding a check produces, or null when there was nothing to check. */
export function claimFinding(c: ClaimCheck): ClaimFinding | null {
  if (c.kind === "none") return null;
  const base = { boundaryAreaM2: Math.round(c.boundaryM2), ruleVersion: CLAIMS_RULE_VERSION };
  if (c.kind === "area") {
    const evidence = { ...base, claimed: c.claimed, unit: c.unitName, claimedAreaM2: Math.round(c.claimedM2), ratio: Number(c.ratio.toFixed(2)), tolerance: AREA_TOLERANCE };
    const claimed = c.unitName === "hectares" ? `${num(c.claimed, 2)} hectares` : `${num(c.claimed, 2)} ${c.unitName} (${hectares(c.claimedM2)})`;
    return c.exceeds
      ? { kind: "CLAIM_EXCEEDS_AREA", severity: "MEDIUM", reason: `The claim is ${claimed}, but the registered boundary covers ${hectares(c.boundaryM2)}: ${num(c.ratio, 1)} times the area that was drawn.`, evidence }
      : { kind: "CLAIM_CHECKED", severity: "INFO", reason: `The claimed ${claimed} fit within the registered boundary of ${hectares(c.boundaryM2)}.`, evidence };
  }
  const perHectare = Math.round(c.perHectare);
  const evidence = { ...base, plants: c.plants, unit: c.unit, perHectare, perSquareMetre: Number(c.perSquareMetre.toFixed(2)), maxPerSquareMetre: MAX_PLANTS_PER_M2 };
  const density = `${num(c.plants)} ${c.unit} over ${hectares(c.boundaryM2)} is about ${num(perHectare)} per hectare (${num(c.perSquareMetre, 2)} per square metre)`;
  return c.implausible
    ? { kind: "CLAIM_DENSITY_IMPLAUSIBLE", severity: "MEDIUM", reason: `${density}, more than even the densest planting methods use (about 3 to 5 per square metre). The claim may count something else, or the boundary may be too small.`, evidence }
    : { kind: "CLAIM_CHECKED", severity: "INFO", reason: `${density}.`, evidence };
}
