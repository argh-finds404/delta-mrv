import { NextResponse } from "next/server";
import "../../../../../server/services/job-handlers";
import { SWEEP_JOB } from "../../../../../server/services/intake-jobs";
import { drainJobs, enqueueJob } from "../../../../../server/services/jobs.service";
import { refuseUnlessCron } from "../../../_lib/cron";

// The queue's safety net (docs/01-FEATURE-LOCK.md M6): an hourly cron calls this with
// `Authorization: Bearer $CRON_SECRET`; intake also drains after its own response.
export async function GET(request: Request) {
  const refusal = refuseUnlessCron(request, "the job drain");
  if (refusal) return refusal;
  // the abandoned-draft sweep, once a day: the date in the key makes every later call a no-op
  await enqueueJob({ kind: SWEEP_JOB, payload: {}, idempotencyKey: `${SWEEP_JOB}:${new Date().toISOString().slice(0, 10)}` });
  const tally = await drainJobs();
  return NextResponse.json(tally, { headers: { "Cache-Control": "no-store" } });
}
