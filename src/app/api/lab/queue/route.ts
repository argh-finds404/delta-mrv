import { NextResponse } from "next/server";
import { getSession } from "../../../../server/auth/session";
import { reviewQueueOverview } from "../../../../server/services/reviews.service";

// The Lab's queue: the caller's assigned, in-review submissions (docs/05-ROUTES.md §3.1).
// Not being a verifier is a normal answer (an empty overview), not an error.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const overview = await reviewQueueOverview({ userId: session.user.id });
  return NextResponse.json(overview, { headers: { "Cache-Control": "no-store" } });
}
