import { NextResponse } from "next/server";
import { jsonFeed } from "../../../../../../lib/feeds";
import { NotFoundError } from "../../../../../../server/services/errors";
import { projectFeed } from "../../../../../../server/services/feeds.service";

// A project's anchored records as JSON Feed 1.1. Public, session-blind and pull-only: a partner
// polls it; nothing is pushed (S10 webhooks stay cut).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const feed = jsonFeed(await projectFeed((await params).id), new URL(request.url).origin);
    return NextResponse.json(feed, { headers: { "Content-Type": "application/feed+json; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
