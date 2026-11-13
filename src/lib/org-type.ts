// What an organisation is (docs/04-AUTH.md §2). The org_type enum in
// src/server/db/schema/auth.ts is the authority; keep the two in step.
export const ORG_TYPES = ["OWNER", "VERIFIER", "FUNDER"] as const;
export type OrgType = (typeof ORG_TYPES)[number];

/**
 * Who may run anchoring and see the batch table: an admin or owner of a VERIFIER organisation.
 * There is no platform-admin role (docs/04-AUTH.md §4), and anchoring decides nothing: it
 * publishes the roots of records two reviewers already approved. The service enforces this;
 * pages use it only to decide whether to show the tab.
 */
export const canRunAnchoring = (memberships: readonly { orgType: OrgType; role: string }[]) =>
  memberships.some((m) => m.orgType === "VERIFIER" && (m.role === "admin" || m.role === "owner"));
