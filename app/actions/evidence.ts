"use server";

import { z } from "zod";
import {
  processEvidenceSubmission,
  type EvidenceProcessingResult,
} from "@/src/server/services/forensics.service";

const UploadEvidenceSchema = z.object({
  projectSlug: z.string().min(2, "Project slug is required"),
  longitude: z.coerce.number().optional(),
  latitude: z.coerce.number().optional(),
});

export async function submitEvidenceAction(
  formData: FormData
): Promise<{ data: EvidenceProcessingResult | null; error: string | null }> {
  try {
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return { data: null, error: "A valid photo file is required." };
    }

    const rawFields = {
      projectSlug: formData.get("projectSlug"),
      longitude: formData.get("longitude") || undefined,
      latitude: formData.get("latitude") || undefined,
    };

    const parsed = UploadEvidenceSchema.safeParse(rawFields);
    if (!parsed.success) {
      return {
        data: null,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fallbackCoordinates: [number, number] | undefined =
      parsed.data.longitude !== undefined && parsed.data.latitude !== undefined
        ? [parsed.data.longitude, parsed.data.latitude]
        : undefined;

    const result = await processEvidenceSubmission({
      buffer,
      filename: file.name,
      contentType: file.type || "image/jpeg",
      projectSlug: parsed.data.projectSlug,
      fallbackCoordinates,
    });

    return { data: result, error: null };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to process and verify evidence";
    return { data: null, error: message };
  }
}

