import { NextResponse } from "next/server";
import { anchorPending } from "../../../../../server/services/anchor.service";
import { ChainUnavailable } from "../../../../../server/services/errors";
import { refuseUnlessCron } from "../../../_lib/cron";

// The daily anchor (docs/09-WEB3.md §5): a cron calls this with `Authorization: Bearer
// $CRON_SECRET`. It batches what was approved since the last run, sends one root, and picks up
// any batch an earlier run left unfinished.
export async function GET(request: Request) {
  const refusal = refuseUnlessCron(request, "the daily anchor");
  if (refusal) return refusal;
  // ?before=<ISO time> closes the batch at that moment: records approved later wait for the next one
  const before = new URL(request.url).searchParams.get("before");
  const approvedBefore = before ? new Date(before) : undefined;
  if (approvedBefore && Number.isNaN(approvedBefore.getTime())) return NextResponse.json({ error: "before must be an ISO 8601 time" }, { status: 422 });
  try {
    return NextResponse.json(await anchorPending({ approvedBefore }), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ChainUnavailable) return NextResponse.json({ error: "anchoring is not configured on this server" }, { status: 503 });
    throw e;
  }
}
