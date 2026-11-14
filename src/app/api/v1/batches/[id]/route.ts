import { NextResponse } from "next/server";
import { NotFoundError } from "../../../../../server/services/errors";
import { publicBatch } from "../../../../../server/services/feeds.service";

// One confirmed batch with every leaf, so anyone can rebuild its Merkle root, compare it with the
// contract, and keep a copy: a record later removed from Delta stays provable from that copy.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(await publicBatch(Number((await params).id)), { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
