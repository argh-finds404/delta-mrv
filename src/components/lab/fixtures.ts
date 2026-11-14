// Delta MRV Evidence Lab Fixtures
// Authority: docs/10-FORENSICS.md, docs/14-PAGE-SPEC.md §5, docs/15-UI-STATES.md §2

import type { SubmissionStatus } from "@/src/components/status-badge/status-badge";

export type NdviScene = { sceneId: string; datetime: string; cloudCover: number; ndvi: number; pixels: number; clear: number };

export interface LabFinding {
  id: string;
  kind: string;
  /** Which photo the finding is about ("Before photo"), when it concerns one file. */
  subject?: string;
  /** An operator's conclusion about this finding's match reference (admin.service resolveMatchRef). */
  resolution?: { outcome: "CONFIRMED" | "CLEARED"; reason: string; at: string };
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH";
  humanReason: string;
  evidence: {
    ruleVersion: string;
    threshold: number;
    hammingDistance?: number;
    beforeHash?: string;
    afterHash?: string;
    compareHash?: string;
    beforeImageUrl?: string;
    afterImageUrl?: string;
    matchImageUrl?: string;
    matchRef?: string;
    toleranceMeters?: number;
    distanceMeters?: number;
    exifGps?: { lat: number; lng: number };
    boundaryCenter?: { lat: number; lng: number };
    ruleTitle?: string;
    notes?: string;
    /** X1: the satellite cross-check's result (src/server/services/ndvi.service.ts). */
    ndvi?: {
      outcome: "measured" | "inconclusive";
      baseline?: NdviScene;
      current?: NdviScene;
      delta?: number;
      reason?: string;
    };
    /** Whatever the check recorded about how it ran, shown as is in the raw tier. */
    telemetry?: unknown;
  };
}

export interface LabSubmission {
  id: string;
  projectTitle: string;
  projectSlug: string;
  ownerOrgName: string;
  activityType: string;
  submittedAt: string;
  status: SubmissionStatus;
  userHasDecided: boolean;
  userDecision?: "APPROVE" | "REJECT" | "REQUEST_MORE_PROOF";
  isEscalated?: boolean;
  approvalsCount: number;
  rejectionsCount: number;
  requiredQuorum: number;
  findingCounts: {
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  beforeImage: {
    url: string;
    sha256: string;
    capturedAt: string;
    dhash: string;
    width: number;
    height: number;
  };
  afterImage: {
    url: string;
    sha256: string;
    capturedAt: string;
    dhash: string;
    width: number;
    height: number;
  };
  exif: {
    hasGps: boolean;
    gps?: { lat: number; lng: number };
    capturedAt?: string;
    cameraModel?: string;
    insideBoundary: boolean;
    distanceToBoundaryMeters?: number;
  };
  findings: LabFinding[];
}

// Self-contained SVGs for offline, deterministic rendering. Artwork only: captions and
// hashes are rendered by the Lab from data, under the image (docs/19-LAYOUT-SPEC.md §5, §7).
const beforeMangroveSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600"><rect width="800" height="600" fill="%231a2621"/><path d="M0,450 Q200,420 400,460 T800,430 L800,600 L0,600 Z" fill="%232d3d34"/><circle cx="200" cy="460" r="18" fill="%233e5446"/><line x1="200" y1="460" x2="200" y2="420" stroke="%23567761" stroke-width="4"/><circle cx="380" cy="470" r="14" fill="%233e5446"/><line x1="380" y1="470" x2="380" y2="435" stroke="%23567761" stroke-width="3"/><circle cx="580" cy="450" r="22" fill="%233e5446"/><line x1="580" y1="450" x2="580" y2="400" stroke="%23567761" stroke-width="4"/></svg>`;

const afterMangroveSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600"><rect width="800" height="600" fill="%2314201E"/><path d="M0,450 Q200,420 400,460 T800,430 L800,600 L0,600 Z" fill="%231E332A"/><ellipse cx="200" cy="380" rx="65" ry="85" fill="%232D5A43"/><circle cx="200" cy="350" r="50" fill="%233E7E5E"/><ellipse cx="380" cy="390" rx="55" ry="75" fill="%232D5A43"/><circle cx="380" cy="360" r="45" fill="%233E7E5E"/><ellipse cx="580" cy="370" rx="75" ry="95" fill="%232D5A43"/><circle cx="580" cy="330" r="60" fill="%233E7E5E"/><line x1="200" y1="460" x2="200" y2="400" stroke="%23162b20" stroke-width="8"/><line x1="380" y1="470" x2="380" y2="410" stroke="%23162b20" stroke-width="7"/><line x1="580" y1="450" x2="580" y2="390" stroke="%23162b20" stroke-width="9"/></svg>`;

const foreignMatchSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600"><rect width="800" height="600" fill="%23281715"/><ellipse cx="380" cy="390" rx="55" ry="75" fill="%237e3d36"/><circle cx="380" cy="360" r="45" fill="%23a84b42"/></svg>`;

export const sampleLabSubmissions: LabSubmission[] = [
  {
    id: "sub_01HX98Z1K82N4B1A00000001",
    projectTitle: "Sundarbans Coastal Mangrove Belt",
    projectSlug: "sundarbans-corridor",
    ownerOrgName: "Bagerhat Climate Resiliency Co-op",
    activityType: "Mangrove Afforestation",
    submittedAt: "2024-10-18T09:42:15Z",
    status: "IN_REVIEW",
    userHasDecided: false,
    approvalsCount: 1,
    rejectionsCount: 0,
    requiredQuorum: 2,
    findingCounts: {
      high: 1,
      medium: 1,
      low: 1,
      info: 2,
    },
    beforeImage: {
      url: beforeMangroveSvg,
      sha256: "4a2b8e19c3d4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0",
      capturedAt: "2024-03-12T10:14:00Z",
      dhash: "1100110010101010111100001100110010101010111100001100110010101010",
      width: 800,
      height: 600,
    },
    afterImage: {
      url: afterMangroveSvg,
      sha256: "9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e",
      capturedAt: "2024-10-18T09:30:00Z",
      dhash: "1100110010101010111100001100110010101010111100001100110010111111",
      width: 800,
      height: 600,
    },
    exif: {
      hasGps: true,
      gps: { lat: 21.9497, lng: 89.1833 },
      capturedAt: "2024-10-18T09:30:00Z",
      cameraModel: "Sony Alpha 7 IV",
      insideBoundary: true,
      distanceToBoundaryMeters: 0,
    },
    findings: [
      {
        id: "find_01HX98Z1_HIGH",
        kind: "PERCEPTUAL_MATCH_OTHER_ORG",
        severity: "HIGH",
        humanReason:
          "Perceptual dHash matches an existing submission from a different organisation (Hamming distance 5, threshold < 8). High fraud risk: identical photography claimed against separate grants.",
        evidence: {
          ruleVersion: "v1.4.0",
          threshold: 8,
          hammingDistance: 5,
          beforeHash: "1100110010101010111100001100110010101010111100001100110010101010",
          compareHash: "1100110010101010111100001100110010101010111100001100110010111111",
          beforeImageUrl: afterMangroveSvg,
          matchImageUrl: foreignMatchSvg,
          matchRef: "match_8f90c37b92e4",
          ruleTitle: "Perceptual Near-Duplicate Across Organisations",
          notes:
            "Cross-tenant privacy guard: source organisation identifier is redacted under docs/10-FORENSICS.md §4. Only platform administrators may resolve matchRef.",
        },
      },
      {
        id: "find_01HX98Z1_MED",
        kind: "CLIENT_HASH_MISMATCH",
        severity: "MEDIUM",
        humanReason:
          "Client-computed SHA-256 header differs from server-computed file digest on byte re-read. May indicate client-side compression or proxy mutation.",
        evidence: {
          ruleVersion: "v1.2.1",
          threshold: 0,
          beforeHash: "4a2b8e19c3d4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0",
          compareHash: "4a2b8e19c3d4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9b9",
          ruleTitle: "Client vs Server Digest Verification",
          notes: "Server digest computed over raw bytes in blob storage.",
        },
      },
      {
        id: "find_01HX98Z1_LOW",
        kind: "EXIF_TIMESTAMP_MISSING",
        severity: "LOW",
        humanReason: "SubSecTimeOriginal EXIF tag missing; fallback to seconds resolution.",
        evidence: {
          ruleVersion: "v1.0.0",
          threshold: 1,
          ruleTitle: "Sub-second Precision Check",
        },
      },
      {
        id: "find_01HX98Z1_INFO",
        kind: "GPS_INSIDE_BOUNDARY",
        severity: "INFO",
        humanReason: "EXIF GPS point (21.9497° N, 89.1833° E) is located inside the registered project polygon.",
        evidence: {
          ruleVersion: "v1.1.0",
          threshold: 0,
          distanceMeters: 0,
          toleranceMeters: 15,
          exifGps: { lat: 21.9497, lng: 89.1833 },
          boundaryCenter: { lat: 21.95, lng: 89.184 },
          ruleTitle: "Boundary Containment Verification",
        },
      },
    ],
  },
  {
    id: "sub_02JX98Z2M93P5C2B00000002",
    projectTitle: "Cox's Bazar Coastal Forest Embankment",
    projectSlug: "coxs-bazar-embankment",
    ownerOrgName: "Teknaf Marine Conservation",
    activityType: "Coastal Buffer Restoration",
    submittedAt: "2024-10-17T14:10:00Z",
    status: "ESCALATED",
    userHasDecided: true,
    userDecision: "APPROVE",
    isEscalated: true,
    approvalsCount: 1,
    rejectionsCount: 1,
    requiredQuorum: 2,
    findingCounts: {
      high: 0,
      medium: 2,
      low: 0,
      info: 1,
    },
    beforeImage: {
      url: beforeMangroveSvg,
      sha256: "b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2",
      capturedAt: "2024-02-10T11:00:00Z",
      dhash: "1010101010101010111111110000000010101010101010101111111100000000",
      width: 800,
      height: 600,
    },
    afterImage: {
      url: afterMangroveSvg,
      sha256: "c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3",
      capturedAt: "2024-10-17T13:45:00Z",
      dhash: "1010101010101010111111110000001110101010101010101111111100000000",
      width: 800,
      height: 600,
    },
    exif: {
      hasGps: true,
      gps: { lat: 21.4272, lng: 92.0058 },
      capturedAt: "2024-10-17T13:45:00Z",
      cameraModel: "Nikon Z8",
      insideBoundary: false,
      distanceToBoundaryMeters: 38.4,
    },
    findings: [
      {
        id: "find_02JX_MED1",
        kind: "GPS_OUTSIDE_BOUNDARY",
        severity: "MEDIUM",
        humanReason:
          "EXIF coordinates are 38.4 m outside registered boundary (tolerance: 15.0 m). Split decision: verifier 1 approved citing buffer zone planting, verifier 2 rejected for boundary non-conformance.",
        evidence: {
          ruleVersion: "v1.2.0",
          threshold: 15,
          distanceMeters: 38.4,
          toleranceMeters: 15.0,
          exifGps: { lat: 21.4272, lng: 92.0058 },
          boundaryCenter: { lat: 21.428, lng: 92.0065 },
          ruleTitle: "Geofence Distance Threshold Check",
        },
      },
      {
        id: "find_02JX_MED2",
        kind: "NO_VISIBLE_CHANGE",
        severity: "MEDIUM",
        humanReason: "Before/After change delta is minimal (Hamming distance 2).",
        evidence: {
          ruleVersion: "v1.1.0",
          threshold: 4,
          hammingDistance: 2,
          beforeHash: "1010101010101010111111110000000010101010101010101111111100000000",
          compareHash: "1010101010101010111111110000001110101010101010101111111100000000",
          ruleTitle: "Perceptual Change Delta Verification",
        },
      },
    ],
  },
  {
    id: "sub_03KX98Z3N04Q6D3C00000003",
    projectTitle: "Sylhet Lowland Reforestation Block B",
    projectSlug: "sylhet-reforestation",
    ownerOrgName: "Surma Basin Foundation",
    activityType: "Native Agroforestry",
    submittedAt: "2024-10-16T11:22:00Z",
    status: "IN_REVIEW",
    userHasDecided: false,
    approvalsCount: 0,
    rejectionsCount: 0,
    requiredQuorum: 2,
    findingCounts: {
      high: 0,
      medium: 1,
      low: 2,
      info: 1,
    },
    beforeImage: {
      url: beforeMangroveSvg,
      sha256: "d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4",
      capturedAt: "2024-01-15T09:00:00Z",
      dhash: "1111000011110000111100001111000010101010101010100101010101010101",
      width: 800,
      height: 600,
    },
    afterImage: {
      url: afterMangroveSvg,
      sha256: "e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5",
      capturedAt: "2024-10-16T10:50:00Z",
      dhash: "1111000011110000111100001111000010101010101010100101010111111111",
      width: 800,
      height: 600,
    },
    exif: {
      hasGps: true,
      gps: { lat: 24.8949, lng: 91.8687 },
      capturedAt: "2024-10-16T10:50:00Z",
      cameraModel: "Canon EOS R5",
      insideBoundary: true,
      distanceToBoundaryMeters: 0,
    },
    findings: [
      {
        id: "find_03KX_MED",
        kind: "EXIF_TIMESTAMP_IMPLAUSIBLE",
        severity: "MEDIUM",
        humanReason:
          "Capture timestamp is within 32 minutes of project submission, but before photo was taken 9 months prior.",
        evidence: {
          ruleVersion: "v1.0.2",
          threshold: 0,
          ruleTitle: "Chronological Sequence Sanity Check",
        },
      },
      {
        id: "find_03KX_LOW",
        kind: "PERCEPTUAL_MATCH_SAME_PROJECT",
        severity: "LOW",
        humanReason:
          "Close perceptual match with an earlier baseline submission in the same project plot (expected continuity).",
        evidence: {
          ruleVersion: "v1.4.0",
          threshold: 8,
          hammingDistance: 4,
          beforeHash: "1111000011110000111100001111000010101010101010100101010101010101",
          compareHash: "1111000011110000111100001111000010101010101010100101010111111111",
          ruleTitle: "Intra-Project Perceptual Continuity",
        },
      },
    ],
  },
  {
    id: "sub_04LX98Z4P15R7E4D00000004",
    projectTitle: "Chattogram Hill Tracts Canopy Restoration",
    projectSlug: "chattogram-canopy",
    ownerOrgName: "Hill Tracts Ecological Initiative",
    activityType: "Forest Canopy Enhancement",
    submittedAt: "2024-10-15T08:15:00Z",
    status: "IN_REVIEW",
    userHasDecided: false,
    approvalsCount: 0,
    rejectionsCount: 0,
    requiredQuorum: 2,
    findingCounts: {
      high: 0,
      medium: 0,
      low: 0,
      info: 2,
    },
    beforeImage: {
      url: beforeMangroveSvg,
      sha256: "f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6",
      capturedAt: "2024-03-01T10:00:00Z",
      dhash: "0000111100001111000011110000111100001111000011110000111100001111",
      width: 800,
      height: 600,
    },
    afterImage: {
      url: afterMangroveSvg,
      sha256: "a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7",
      capturedAt: "2024-10-15T08:00:00Z",
      dhash: "0000111100001111000011110000111111110000111100001111000011110000",
      width: 800,
      height: 600,
    },
    exif: {
      hasGps: true,
      gps: { lat: 22.3569, lng: 91.7832 },
      capturedAt: "2024-10-15T08:00:00Z",
      cameraModel: "Sony Alpha 7 IV",
      insideBoundary: true,
      distanceToBoundaryMeters: 0,
    },
    findings: [], // Clean forensic report
  },
];

