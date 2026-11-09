/**
 * One restoration site as the Atlas draws it. The server decides `area` (docs/14-PAGE-SPEC.md §2):
 * everyone gets the approximate grid cell; only an authorised session is ever handed `exact`.
 * The map renders what it is given and has no opinion.
 */
export type AtlasSite = {
  id: string;
  title: string;
  ownerOrgName: string;
  /** Plain language, never the enum. */
  activity: string;
  /** Formatted claim, e.g. "12,000 saplings". */
  claim: string | null;
  commitment: string | null;
  area:
    | { kind: "approximate"; center: [number, number] }
    | { kind: "exact"; center: [number, number]; ring: [number, number][] };
};

/** What /api/v1/projects/[id] adds when a site is opened: public counts and names only. */
export type AtlasSiteRecord = {
  verifierOrgNames: string[];
  record: { approved: number; anchored: number };
};
