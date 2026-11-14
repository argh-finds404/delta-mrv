import { NextResponse } from "next/server";
import { listPublicBatches } from "../../../../server/services/feeds.service";

// The newest confirmed anchor batches. Each one's leaves are at /api/v1/batches/[id].
export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 50);
  return NextResponse.json({ items: await listPublicBatches(Number.isFinite(limit) ? limit : 50) }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
