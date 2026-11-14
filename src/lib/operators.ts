// Operators run the platform (docs/00-PRODUCT.md §4, the "platform admin"): anchoring, the job
// queue, audit-chain checks, assigning reviewers, resolving duplicate matches. It is an operations
// role, not a trust role: an operator holds no vote (docs/04-AUTH.md §4).
//
// Who is one is configuration, OPERATOR_EMAILS, a comma-separated list. Email verification is off
// in this build, so whoever registers an address first owns it: create the operator account
// before the address is listed on a deployment others can sign up to.

/** OPERATOR_EMAILS as a set of lowercase addresses. Blank entries and surrounding spaces are ignored. */
export function parseOperatorEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@")),
  );
}
