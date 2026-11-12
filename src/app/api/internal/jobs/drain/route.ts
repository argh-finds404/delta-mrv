import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { requireEnv } from "../../../../../env";
import "../../../../../server/services/job-handlers";
import { SWEEP_JOB } from "../../../../../server/services/intake-jobs";
import { drainJobs, enqueueJob } from "../../../../../server/services/jobs.service";

// The queue's safety net (docs/01-FEATURE-LOCK.md M6): an hourly cron calls this with
// `Authorization: Bearer $CRON_SECRET`; intake also drains after its own response.
const digest = (s: string) => createHash("sha256").update(s).digest();

export async function GET(request: Request) {
  let secret: string;
  try {
    secret = requireEnv("CRON_SECRET");
  } catch {
    // unset on this deployment: say so, without saying anything about the secret itself
    return NextResponse.json({ error: "the job drain is not configured" }, { status: 503 });
  }
  // equal-length digests, so the comparison takes the same time whatever was sent
  const given = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(given), digest(`Bearer ${secret}`))) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  // the abandoned-draft sweep, once a day: the date in the key makes every later call a no-op
  await enqueueJob({ kind: SWEEP_JOB, payload: {}, idempotencyKey: `${SWEEP_JOB}:${new Date().toISOString().slice(0, 10)}` });
  const tally = await drainJobs();
  return NextResponse.json(tally, { headers: { "Cache-Control": "no-store" } });
}
