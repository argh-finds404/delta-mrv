import { lookupProofs } from "../../../../../server/services/submissions.service";
import { errorResponse, NO_STORE } from "../../../_lib/http";

// /verify's lookup (docs/16-AMENDMENTS-v2.md A7). Public and unauthenticated: it only ever
// points at proofs that are already public. A file is hashed in the browser; only its SHA-256
// arrives here.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    return Response.json({ matches: await lookupProofs(q) }, { headers: NO_STORE });
  } catch (e) {
    return errorResponse(e);
  }
}
