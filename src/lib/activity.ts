import type { ActivityType } from "./format";

// One hue per kind of restoration: the map's site colours and the cards' accents agree.
// The values mirror --act-* in globals.css (MapLibre paints with literal colours, not CSS).
export const ACTIVITY_COLOR: Record<ActivityType, string> = {
  MANGROVE: "#13896F",
  WETLAND: "#2F78C4",
  RIVER_CLEANUP: "#7A57D1",
  TREE_PLANTING: "#4E9A2F",
  COASTAL_BELT: "#D9772B",
};

const BY_LABEL: Record<string, string> = {
  Mangrove: ACTIVITY_COLOR.MANGROVE,
  Wetland: ACTIVITY_COLOR.WETLAND,
  "River clean-up": ACTIVITY_COLOR.RIVER_CLEANUP,
  "Tree planting": ACTIVITY_COLOR.TREE_PLANTING,
  "Coastal belt": ACTIVITY_COLOR.COASTAL_BELT,
};

/** The hue for an activity given as its enum or as its plain-language label. */
export const activityColor = (activity: string) => ACTIVITY_COLOR[activity as ActivityType] ?? BY_LABEL[activity] ?? "#5B6763";
