import "server-only";

// Siblings, not a hierarchy: a ConflictOfInterestError must never satisfy an
// `instanceof ForbiddenError` check, or the two rules could mask each other.
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Authenticated, but not allowed. Only for resources the caller may know exist. */
export class ForbiddenError extends DomainError {}

/** The reviewer belongs to the organisation that owns the work (docs/04-AUTH.md §4). */
export class ConflictOfInterestError extends DomainError {}

/** The request conflicts with current state: a second vote, a closed submission. */
export class ConflictError extends DomainError {}

/** Missing, or not visible to the caller. Cross-tenant requests get this, never 403. */
export class NotFoundError extends DomainError {}

export class ValidationError extends DomainError {}
