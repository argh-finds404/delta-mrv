// Display helpers. Isomorphic: server pages format before render, so server and client agree.

export type ActivityType = "MANGROVE" | "WETLAND" | "RIVER_CLEANUP" | "TREE_PLANTING" | "COASTAL_BELT";

/** A database enum never reaches the screen (docs/18-VISUAL-CORRECTION.md §2). */
export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  MANGROVE: "Mangrove",
  WETLAND: "Wetland",
  RIVER_CLEANUP: "River clean-up",
  TREE_PLANTING: "Tree planting",
  COASTAL_BELT: "Coastal belt",
};

const whole = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

export const formatCount = (n: number) => whole.format(n);

/** "12,000 saplings". Null when the project made no quantified claim. */
export function formatClaim(quantity: string | null, unit: string | null): string | null {
  if (quantity === null) return null;
  const n = Number(quantity);
  return `${Number.isFinite(n) ? whole.format(n) : quantity}${unit ? ` ${unit}` : ""}`;
}

/** [lon, lat] as "22.3750° N, 89.3250° E": latitude first, the way people read it. */
export function formatLatLon([lon, lat]: [number, number], digits = 4): string {
  const part = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(digits)}° ${v < 0 ? neg : pos}`;
  return `${part(lat, "N", "S")}, ${part(lon, "E", "W")}`;
}
