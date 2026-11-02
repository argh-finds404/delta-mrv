import type { BitGridProps } from "./bit-grid";

export const sampleDHashA =
  "1101011010101100111100001010101011001100101010100011001111001100";

// Near-duplicate with 4 bits flipped (Hamming distance = 4)
export const sampleDHashDuplicate =
  "1101011010101100111100001010101011001100101010100011001111001001";

// Completely distinct hash with 29 bits flipped
export const sampleDHashDistinct =
  "0010100101010011000011110101010100110011010101011100110000110011";

export const bitGridFixtures: Record<string, BitGridProps> = {
  singleHash: {
    hash: sampleDHashA,
    label: "Sundarbans-Plot-04 (Nov 2026)",
    size: "md",
    theme: "field",
  },
  nearDuplicateComparison: {
    hash: sampleDHashA,
    compareHash: sampleDHashDuplicate,
    threshold: 10,
    label: "Original Submission #102",
    compareLabel: "New Upload candidate #109",
    size: "md",
    theme: "field",
  },
  distinctComparison: {
    hash: sampleDHashA,
    compareHash: sampleDHashDistinct,
    threshold: 10,
    label: "Plot A (Mangrove replant)",
    compareLabel: "Plot B (Saline mudflat)",
    size: "md",
    theme: "field",
  },
  paperThemeSingle: {
    hash: sampleDHashA,
    label: "Dossier Certificate dHash",
    size: "sm",
    theme: "paper",
  },
  paperThemeComparison: {
    hash: sampleDHashA,
    compareHash: sampleDHashDuplicate,
    threshold: 10,
    label: "Anchored Leaf",
    compareLabel: "Audited Image",
    size: "sm",
    theme: "paper",
  },
};

