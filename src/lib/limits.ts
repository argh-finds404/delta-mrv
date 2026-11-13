// docs/00-PRODUCT.md §3, verbatim. It appears on the landing page, on /trust and on every
// /proof/[id] page; copy that implies more is a defect. Edit the doc first, then this.

export const PROVES = [
  "The evidence file existed at a recorded point in time",
  "The evidence has not changed since approval (hash comparison against chain)",
  "It passed stated consistency checks — location, duplicates, timestamps",
  "It was approved by named humans from an organisation independent of the claimant",
  "The review history has not been silently rewritten (hash-chained audit log)",
] as const;

export const DOES_NOT_PROVE = [
  "That trees were actually planted, or that they survived",
  "That the photograph was taken where or when the EXIF says",
  "Anything the AI “observed” — that is an opinion, logged as an opinion",
] as const;

/** What the chain comparison above rests on. Shown beside the two lists. */
export const CHAIN_NOTE = "The chain comparison applies once a record is in a confirmed batch; until then its proof page says it is pending and compares nothing.";
