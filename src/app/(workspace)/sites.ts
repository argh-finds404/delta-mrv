import "server-only";
import type { AtlasSite } from "@/src/components/atlas/types";
import { ACTIVITY_LABEL, formatClaim } from "@/src/lib/format";
import { polygonCentroid } from "@/src/lib/geo/fuzz";
import { getProject, type ProjectSummary } from "@/src/server/services/projects.service";

/**
 * Map sites for projects the caller can see in the workspace: the exact boundary where their
 * organisation owns or reviews the project (the service decides), else the public grid cell.
 */
export async function workspaceSites(userId: string, projects: ProjectSummary[]): Promise<AtlasSite[]> {
  const actor = { userId };
  const sites = await Promise.all(
    projects.map(async (p): Promise<AtlasSite | null> => {
      const exact = p.access === "public" ? null : (await getProject(actor, p.id)).exact;
      const ring = exact?.boundary.coordinates[0];
      const base = {
        id: p.id,
        title: p.title,
        ownerOrgName: "",
        activity: ACTIVITY_LABEL[p.activityType],
        claim: formatClaim(p.claimedQuantity, p.claimedUnit),
        commitment: p.locationCommitment,
      };
      if (ring) return { ...base, area: { kind: "exact", ring, center: polygonCentroid(ring) } };
      if (p.fuzzedLocation) return { ...base, area: { kind: "approximate", center: p.fuzzedLocation.coordinates } };
      return null;
    }),
  );
  return sites.filter((s): s is AtlasSite => s !== null);
}
