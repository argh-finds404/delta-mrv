import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { requireEnv } from "../../../env";

const digest = (s: string) => createHash("sha256").update(s).digest();

/**
 * The guard on /api/internal/*: `Authorization: Bearer $CRON_SECRET`. Returns the refusal to
 * send, or null when the caller is the cron. (`_lib` is not a route.)
 */
export function refuseUnlessCron(request: Request, what: string): NextResponse | null {
  let secret: string;
  try {
    secret = requireEnv("CRON_SECRET");
  } catch {
    // unset on this deployment: say so, without saying anything about the secret itself
    return NextResponse.json({ error: `${what} is not configured` }, { status: 503 });
  }
  // equal-length digests, so the comparison takes the same time whatever was sent
  const given = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(given), digest(`Bearer ${secret}`))) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  return null;
}
