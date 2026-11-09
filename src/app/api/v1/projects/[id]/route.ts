import { NextResponse } from "next/server";
import { NotFoundError } from "../../../../../server/services/errors";
import { getPublicProject } from "../../../../../server/services/projects.service";

// Public and session-blind (docs/16-AMENDMENTS-v2.md A6). DRAFT, CLOSED and unknown are one 404.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const project = await getPublicProject((await params).id);
    return NextResponse.json(project, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
