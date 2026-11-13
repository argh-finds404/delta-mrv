import { NextResponse } from "next/server";
import { NotFoundError } from "../../../../../../server/services/errors";
import { getPublicProof } from "../../../../../../server/services/submissions.service";

// Public and unauthenticated by design (docs/05-ROUTES.md §6, docs/13 D4): everything a third
// party needs to verify a record without Delta. The canonical manifest as sealed, the batch and
// the Merkle proof path, the fuzzed point and the location commitment; never the salt or the site.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const proof = await getPublicProof((await params).id);
    return NextResponse.json(proof, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120", "Access-Control-Allow-Origin": "*" } });
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
