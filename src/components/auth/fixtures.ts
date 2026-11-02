import type { AnchoredProofRecord } from "./ProofPreview";

export const sampleAnchoredRecord: AnchoredProofRecord = {
  id: "rec-sundarbans-04-18241",
  projectTitle: "Sundarbans Coastal Mangrove Corridor",
  organization: "Sundarbans Restoration Trust",
  verificationState: "MATCH",
  sha256Hash:
    "a3f2e8c1d5b7a9e0f2c4b6d8e0a2c4e6f8a0b2c4d6e8f0a2b4c6d8e094d7b206",
  approvalsCount: 2,
  totalVerifiedRecords: 3100,
  proofUrl: "/proof/rec-sundarbans-04-18241",
};

export const proofPreviewFixtures = {
  default: sampleAnchoredRecord,
};

