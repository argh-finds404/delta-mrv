import { NextResponse } from "next/server";
import { getSession } from "../../../../server/auth/session";
import { reviewQueueOverview } from "../../../../server/services/reviews.service";

// The Lab's queue: the caller's assigned, in-review submissions (docs/05-ROUTES.md §3.1).
// Not being a verifier is a normal answer (an empty overview), not an error.
export async function GET(request?: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  // ?s=<submission id>: a deep link from elsewhere in the workspace; the service checks it is in this caller's queue
  const focus = (request && new URL(request.url).searchParams.get("s")) || undefined;
  const overview = await reviewQueueOverview({ userId: session.user.id }, undefined, undefined, focus);
  return NextResponse.json(overview, { headers: { "Cache-Control": "no-store" } });
}
