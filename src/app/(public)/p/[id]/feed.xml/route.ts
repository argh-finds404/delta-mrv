import { atomFeed } from "@/src/lib/feeds";
import { NotFoundError } from "@/src/server/services/errors";
import { projectFeed } from "@/src/server/services/feeds.service";

// The same feed as /api/v1/projects/[id]/feed, as Atom 1.0 for feed readers and partner portals.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = atomFeed(await projectFeed((await params).id), new URL(request.url).origin);
    return new Response(body, { headers: { "Content-Type": "application/atom+xml; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (e) {
    if (e instanceof NotFoundError) return new Response("project not found", { status: 404 });
    throw e;
  }
}
