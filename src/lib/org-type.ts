// What an organisation is (docs/04-AUTH.md §2). The org_type enum in
// src/server/db/schema/auth.ts is the authority; keep the two in step.
export const ORG_TYPES = ["OWNER", "VERIFIER", "FUNDER"] as const;
export type OrgType = (typeof ORG_TYPES)[number];
