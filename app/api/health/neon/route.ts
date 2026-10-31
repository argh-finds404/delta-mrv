import { connection, NextResponse } from "next/server";
import { getNeonTelemetry } from "@/src/server/services/database.service";

export async function GET() {
  await connection();
  try {
    const data = await getNeonTelemetry();
    return NextResponse.json({ data, error: null }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to query Lakebase Postgres";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
