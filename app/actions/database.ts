"use server";

import { z } from "zod";
import {
  getNeonTelemetry,
  type NeonTelemetry,
} from "@/src/server/services/database.service";

const CheckTelemetrySchema = z
  .object({
    source: z.string().default("ui"),
  })
  .optional();

export async function checkNeonConnectionAction(
  input?: z.input<typeof CheckTelemetrySchema>
): Promise<{ data: NeonTelemetry | null; error: string | null }> {
  const parsed = CheckTelemetrySchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    const data = await getNeonTelemetry();
    return { data, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to connect to Neon Postgres";
    return { data: null, error: message };
  }
}

