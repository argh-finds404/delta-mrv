import { NextResponse } from "next/server";
import { ValidationError } from "../../../../server/services/errors";
import { listPublicProjects } from "../../../../server/services/projects.service";

// Public and session-blind (docs/16-AMENDMENTS-v2.md A6): every caller gets the same bytes,
// so a shared cache cannot serve one caller's view to another.
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  try {
    const page = await listPublicProjects({ cursor: query.get("cursor") ?? undefined, limit: query.get("limit") ?? undefined });
    return NextResponse.json(page, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 422 });
    throw e;
  }
}
