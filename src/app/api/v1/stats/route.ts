import { NextResponse } from "next/server";
import { authenticateApiKey } from "../../../../server/services/api-key.service";
import { funderPortfolio } from "../../../../server/services/funder.service";

// Aggregate counts for the organisation an API key belongs to (docs/05-ROUTES.md §6):
// `Authorization: Bearer dmrv_<prefix>_<secret>` with the stats:read scope. What a funder may
// see and nothing else: its linked projects, their approved and anchored records.
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const key = await authenticateApiKey(request.headers.get("authorization"));
  if (!key) return NextResponse.json({ error: "a valid API key is required" }, { status: 401, headers: { ...headers, "WWW-Authenticate": "Bearer" } });
  if (!key.scopes.includes("stats:read")) return NextResponse.json({ error: "this key does not carry the stats:read scope" }, { status: 403, headers });
  const { totals, projects } = await funderPortfolio([key.orgId]);
  return NextResponse.json({ totals, projects }, { headers });
}
