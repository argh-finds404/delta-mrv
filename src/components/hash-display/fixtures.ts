import type { HashDisplayProps } from "./hash-display";

export const sampleSha256 =
  "a3f2e8c1d5b7a9e0f2c4b6d8e0a2c4e6f8a0b2c4d6e8f0a2b4c6d8e094d7b206";

export const sampleMerkleRoot =
  "7c8cf8e2644f3e9d80d7f6b814201e0c14131c2b28273a36e8ede98ca39c5b6d";

export const hashDisplayFixtures: Record<string, HashDisplayProps> = {
  fullSha256: {
    hash: sampleSha256,
    variant: "full",
    label: "sha256",
    showCopy: true,
    theme: "field",
  },
  truncatedSha256: {
    hash: sampleSha256,
    variant: "truncated",
    label: "sha256",
    showCopy: true,
    theme: "field",
  },
  fullMerkleRoot: {
    hash: sampleMerkleRoot,
    variant: "full",
    label: "root",
    showCopy: true,
    theme: "field",
  },
  paperThemeTruncated: {
    hash: sampleSha256,
    variant: "truncated",
    label: "digest",
    showCopy: true,
    theme: "paper",
  },
  paperThemeFull: {
    hash: sampleMerkleRoot,
    variant: "full",
    label: "anchor",
    showCopy: true,
    theme: "paper",
  },
  noCopyButton: {
    hash: sampleSha256,
    variant: "truncated",
    showCopy: false,
    theme: "field",
  },
};

