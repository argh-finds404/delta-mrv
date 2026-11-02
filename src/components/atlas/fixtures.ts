export interface AtlasSubmissionItem {
  id: string;
  title: string;
  round: number;
  capturedAt: string;
  status: "APPROVED" | "ANCHORED" | "IN_REVIEW" | "PENDING_FORENSICS" | "REJECTED" | "NEEDS_MORE_PROOF";
  findingsCount: number;
  proofUrl?: string;
}

export interface AtlasProject {
  id: string;
  slug: string;
  title: string;
  ownerOrg: string;
  activityType: "Mangrove Restoration" | "Reforestation" | "Agroforestry" | "Wetland Conservation";
  reportedImpact: string;
  verifiedImpact: string;
  claimedVsVerifiedGap: string;
  verificationStatus: "MATCH" | "PENDING" | "MISMATCH" | "UNAVAILABLE";
  submissionCounts: {
    draft: number;
    pendingForensics: number;
    inReview: number;
    needsMoreProof: number;
    escalated: number;
    approved: number;
    anchored: number;
    rejected: number;
  };
  location: {
    region: string;
    coordinatesFuzzed: [number, number]; // [lon, lat]
    isFuzzed: boolean;
  };
  assignedVerifiers: Array<{
    name: string;
    slug: string;
  }>;
  timeline: AtlasSubmissionItem[];
}

export const sampleAtlasProjects: AtlasProject[] = [
  {
    id: "proj-sundarbans-01",
    slug: "sundarbans-corridor",
    title: "Sundarbans Coastal Mangrove Corridor",
    ownerOrg: "Sundarbans Restoration Trust",
    activityType: "Mangrove Restoration",
    reportedImpact: "500 hectares canopy replanted",
    verifiedImpact: "310 hectares independently verified & anchored",
    claimedVsVerifiedGap: "190 hectares (38%) pending review or unverified",
    verificationStatus: "MATCH",
    submissionCounts: {
      draft: 0,
      pendingForensics: 1,
      inReview: 2,
      needsMoreProof: 1,
      escalated: 0,
      approved: 2,
      anchored: 14,
      rejected: 1,
    },
    location: {
      region: "Khulna Division, Sundarbans Delta",
      coordinatesFuzzed: [89.2465, 21.9497],
      isFuzzed: true,
    },
    assignedVerifiers: [
      { name: "Delta Independent Audit", slug: "delta-audit" },
      { name: "Global Carbon Bureau", slug: "gcb-verify" },
    ],
    timeline: [
      {
        id: "rec-sundarbans-04-18241",
        title: "Plot 04 — Tidal Rhizophora replanting",
        round: 1,
        capturedAt: "2026-10-24T06:30:00Z",
        status: "ANCHORED",
        findingsCount: 0,
        proofUrl: "/proof/rec-sundarbans-04-18241",
      },
      {
        id: "sub-sun-108",
        title: "Plot 03 — Saline nursery establishment",
        round: 1,
        capturedAt: "2026-10-28T09:15:00Z",
        status: "APPROVED",
        findingsCount: 1,
      },
      {
        id: "sub-sun-109",
        title: "Plot 05 — Mudflat boundary expansion",
        round: 2,
        capturedAt: "2026-11-01T11:45:00Z",
        status: "IN_REVIEW",
        findingsCount: 1,
      },
      {
        id: "sub-sun-110",
        title: "Plot 06 — Drone transect survey",
        round: 1,
        capturedAt: "2026-11-02T04:20:00Z",
        status: "PENDING_FORENSICS",
        findingsCount: 0,
      },
    ],
  },
  {
    id: "proj-sylhet-02",
    slug: "sylhet-reforestation",
    title: "Sylhet Watershed Native Tree Sanctuary",
    ownerOrg: "Surma Ecological Initiative",
    activityType: "Reforestation",
    reportedImpact: "150,000 indigenous broadleaf saplings",
    verifiedImpact: "82,500 saplings anchored on Base Sepolia",
    claimedVsVerifiedGap: "67,500 saplings (45%) awaiting second reviewer quorum",
    verificationStatus: "PENDING",
    submissionCounts: {
      draft: 2,
      pendingForensics: 0,
      inReview: 3,
      needsMoreProof: 0,
      escalated: 1,
      approved: 1,
      anchored: 6,
      rejected: 0,
    },
    location: {
      region: "Sylhet Division, Surma Basin",
      coordinatesFuzzed: [91.8687, 24.8949],
      isFuzzed: true,
    },
    assignedVerifiers: [
      { name: "Delta Independent Audit", slug: "delta-audit" },
    ],
    timeline: [
      {
        id: "sub-syl-201",
        title: "Ridge sector B — Native Dipterocarp canopy",
        round: 1,
        capturedAt: "2026-10-15T08:00:00Z",
        status: "ANCHORED",
        findingsCount: 0,
        proofUrl: "/proof/sub-syl-201",
      },
      {
        id: "sub-syl-202",
        title: "Riparian buffer zone replanting",
        round: 1,
        capturedAt: "2026-10-30T10:10:00Z",
        status: "IN_REVIEW",
        findingsCount: 2,
      },
    ],
  },
  {
    id: "proj-coxs-03",
    slug: "coxs-bazar-coastal-shield",
    title: "Cox's Bazar Coastal Bio-Shield",
    ownerOrg: "Coastal Resilience Fund",
    activityType: "Wetland Conservation",
    reportedImpact: "12 kilometers coastal casuarina dune shelter",
    verifiedImpact: "11.2 kilometers verified with zero duplicate signals",
    claimedVsVerifiedGap: "0.8 kilometers pending camera GPS re-calibration",
    verificationStatus: "MATCH",
    submissionCounts: {
      draft: 0,
      pendingForensics: 0,
      inReview: 1,
      needsMoreProof: 1,
      escalated: 0,
      approved: 3,
      anchored: 19,
      rejected: 0,
    },
    location: {
      region: "Chittagong Division, Teknaf Peninsula",
      coordinatesFuzzed: [92.0101, 21.4272],
      isFuzzed: true,
    },
    assignedVerifiers: [
      { name: "Global Carbon Bureau", slug: "gcb-verify" },
    ],
    timeline: [
      {
        id: "sub-cox-301",
        title: "Dune stabilization Transect North",
        round: 1,
        capturedAt: "2026-09-12T07:45:00Z",
        status: "ANCHORED",
        findingsCount: 0,
        proofUrl: "/proof/sub-cox-301",
      },
    ],
  },
  {
    id: "proj-dhaka-04",
    slug: "dhaka-urban-canopy",
    title: "Greater Dhaka Urban Micro-Forests",
    ownerOrg: "Green Dhaka Coalition",
    activityType: "Agroforestry",
    reportedImpact: "45 micro-forest pockets across public rights-of-way",
    verifiedImpact: "12 micro-forests anchored on Base Sepolia",
    claimedVsVerifiedGap: "33 micro-forests (73%) pending field inspections",
    verificationStatus: "PENDING",
    submissionCounts: {
      draft: 4,
      pendingForensics: 2,
      inReview: 4,
      needsMoreProof: 2,
      escalated: 1,
      approved: 1,
      anchored: 3,
      rejected: 2,
    },
    location: {
      region: "Dhaka District, Turag River Basin",
      coordinatesFuzzed: [90.4125, 23.8103],
      isFuzzed: true,
    },
    assignedVerifiers: [
      { name: "Delta Independent Audit", slug: "delta-audit" },
    ],
    timeline: [
      {
        id: "sub-dhk-401",
        title: "Mirpur canal pocket bio-filter",
        round: 1,
        capturedAt: "2026-10-02T13:30:00Z",
        status: "ANCHORED",
        findingsCount: 0,
        proofUrl: "/proof/sub-dhk-401",
      },
    ],
  },
];

// Empty project with 0 proofs for testing Empty State E2
export const emptyProofProject: AtlasProject = {
  id: "proj-empty-05",
  slug: "chittagong-hill-tracts-pilot",
  title: "Chittagong Hill Tracts Pilot Ingestion",
  ownerOrg: "Indigenous Forestry Collective",
  activityType: "Reforestation",
  reportedImpact: "25,000 hill bamboo culms planted",
  verifiedImpact: "0 culms verified yet",
  claimedVsVerifiedGap: "25,000 culms (100%) awaiting initial evidence submission",
  verificationStatus: "UNAVAILABLE",
  submissionCounts: {
    draft: 1,
    pendingForensics: 0,
    inReview: 0,
    needsMoreProof: 0,
    escalated: 0,
    approved: 0,
    anchored: 0,
    rejected: 0,
  },
  location: {
    region: "Rangamati, Chittagong Hill Tracts",
    coordinatesFuzzed: [92.1791, 22.6533],
    isFuzzed: true,
  },
  assignedVerifiers: [
    { name: "Delta Independent Audit", slug: "delta-audit" },
  ],
  timeline: [],
};
