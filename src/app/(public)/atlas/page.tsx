import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { AtlasExplorer } from "@/src/components/atlas/AtlasExplorer";
import type { AtlasSite } from "@/src/components/atlas/types";
import { Wordmark } from "@/src/components/site/Wordmark";
import { ACTIVITY_LABEL, formatClaim } from "@/src/lib/format";
import { polygonCentroid } from "@/src/lib/geo/fuzz";
import { getSession } from "@/src/server/auth/session";
import { getProject, getPublicOverview, listProjects, listPublicProjects, type PublicProject } from "@/src/server/services/projects.service";

export const metadata: Metadata = {
  title: "Impact atlas · Delta",
  description: "Restoration sites under independent review, shown as approximate areas to protect them.",
};

type Props = { searchParams: Promise<{ site?: string | string[] }> };

export default function AtlasPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<AtlasSkeleton />}>
      <Atlas searchParams={searchParams} />
    </Suspense>
  );
}

async function everyPublicProject(): Promise<PublicProject[]> {
  const all: PublicProject[] = [];
  let cursor: string | undefined;
  // shortcut: stops at 1,000 sites; past that the Atlas should load by viewport instead
  for (let page = 0; page < 10; page++) {
    const { items, nextCursor } = await listPublicProjects({ cursor, limit: 100 });
    all.push(...items);
    if (!nextCursor) break;
    cursor = nextCursor;
  }
  return all;
}

/**
 * Exact rings for the sites the caller's organisation owns or reviews. The server decides
 * geometry (docs/05-ROUTES.md §1); signed out, this is never called.
 */
async function exactRings(userId: string): Promise<Map<string, [number, number][]>> {
  const actor = { userId };
  const rings = new Map<string, [number, number][]>();
  for (const p of await listProjects(actor)) {
    if (p.access === "public" || p.status !== "ACTIVE") continue;
    const { exact } = await getProject(actor, p.id);
    if (exact) rings.set(p.id, exact.boundary.coordinates[0]!);
  }
  return rings;
}

async function Atlas({ searchParams }: Props) {
  await connection();
  const [session, projects, overview] = await Promise.all([getSession(), everyPublicProject(), getPublicOverview()]);
  const exact = session ? await exactRings(session.user.id) : new Map<string, [number, number][]>();

  const sites: AtlasSite[] = projects.flatMap((p) => {
    if (!p.fuzzedLocation) return [];
    const ring = exact.get(p.id);
    return [
      {
        id: p.id,
        title: p.title,
        ownerOrgName: p.ownerOrgName,
        activity: ACTIVITY_LABEL[p.activityType],
        claim: formatClaim(p.claimedQuantity, p.claimedUnit),
        commitment: p.locationCommitment,
        area: ring ? { kind: "exact", ring, center: polygonCentroid(ring) } : { kind: "approximate", center: p.fuzzedLocation.coordinates },
      },
    ];
  });

  const { site } = await searchParams;
  return <AtlasExplorer sites={sites} overview={overview} signedIn={Boolean(session)} initialSiteId={typeof site === "string" ? site : null} />;
}

/** The final layout, empty: the stage and the panel at their real dimensions. */
function AtlasSkeleton() {
  return (
    <div className="fixed inset-0 bg-field-stage text-field-text" aria-busy>
      <div className="hud absolute inset-x-0 bottom-0 h-[45dvh] rounded-b-none min-[900px]:inset-x-auto min-[900px]:bottom-4 min-[900px]:left-4 min-[900px]:top-4 min-[900px]:h-auto min-[900px]:w-[400px] min-[900px]:rounded-b-xl">
        <div className="border-b border-field-hairline px-5 py-4">
          <Wordmark className="text-field-text" />
        </div>
        <div className="space-y-3 px-5 pt-5">
          <div className="h-7 w-44 rounded-sm bg-field-raised" />
          <div className="h-4 w-full rounded-sm bg-field-raised" />
          <div className="h-4 w-3/4 rounded-sm bg-field-raised" />
        </div>
      </div>
    </div>
  );
}
