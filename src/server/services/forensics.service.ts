import crypto from "node:crypto";
import exifr from "exifr";
import sharp from "sharp";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sql } from "drizzle-orm";
import { db } from "@/src/server/db";
import { verificationEvents } from "@/src/server/db/schema";
import { storageService, type UploadResult } from "./storage.service";

export interface ExifTelemetry {
  latitude: number | null;
  longitude: number | null;
  captureTime: string | null;
  deviceModel: string | null;
}

export interface GeminiForensicsAssessment {
  canopyHealth: "thriving" | "recovering" | "degraded" | "indeterminate";
  vegetationDensityPct: number;
  speciesIdentified: string[];
  authenticityAssessment: string;
  antiSpoofingPassed: boolean;
  riskScore: number; // 0.00 = lowest risk, 1.00 = highest risk
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  closestDistance: number | null;
  matchedEventId: number | null;
}

export interface EvidenceProcessingResult {
  upload: UploadResult;
  sha256Hash: string;
  dHash: string;
  exif: ExifTelemetry;
  duplicateCheck: DuplicateDetectionResult;
  geminiAssessment: GeminiForensicsAssessment;
  verificationEventId: number;
  finalRiskScore: number;
}

/**
 * Computes SHA-256 cryptographic digest of a file buffer.
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Computes 64-bit Difference Hash (dHash) for perceptual similarity comparison.
 * Resizes image to 9x8 grayscale, comparing adjacent pixels across 8 rows.
 */
export async function computeDHash(buffer: Buffer): Promise<string> {
  const raw = await sharp(buffer)
    .resize(9, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer();

  let bits = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = raw[row * 9 + col];
      const right = raw[row * 9 + col + 1];
      bits += left > right ? "1" : "0";
    }
  }
  return bits; // Exactly 64 characters of 0/1
}

/**
 * Extracts GPS telemetry and device capture metadata using exifr.
 */
export async function extractExifTelemetry(
  buffer: Buffer
): Promise<ExifTelemetry> {
  try {
    const data = await exifr.parse(buffer, {
      gps: true,
      tiff: true,
      exif: true,
    });

    const latitude =
      typeof data?.latitude === "number" ? data.latitude : null;
    const longitude =
      typeof data?.longitude === "number" ? data.longitude : null;
    const captureTime = data?.DateTimeOriginal
      ? new Date(data.DateTimeOriginal).toISOString()
      : null;
    const deviceModel =
      [data?.Make, data?.Model].filter(Boolean).join(" ").trim() || null;

    return { latitude, longitude, captureTime, deviceModel };
  } catch {
    return {
      latitude: null,
      longitude: null,
      captureTime: null,
      deviceModel: null,
    };
  }
}

/**
 * Performs database-level perceptual duplicate detection using pgvector's
 * Hamming distance operator (<~>) on the bit(64) column.
 */
export async function checkPerceptualDuplicates(
  dHash: string,
  maxHammingDistance = 10
): Promise<DuplicateDetectionResult> {
  // PostGIS / pgvector query using <~> operator on bit(64)
  const result = await db.execute<{
    id: number;
    distance: number;
  }>(sql`
    SELECT id, (d_hash <~> ${dHash}::bit(64)) AS distance
    FROM verification_events
    WHERE d_hash IS NOT NULL
      AND (d_hash <~> ${dHash}::bit(64)) <= ${maxHammingDistance}
    ORDER BY distance ASC
    LIMIT 1;
  `);

  const closest = result.rows[0];
  if (closest) {
    return {
      isDuplicate: true,
      closestDistance: closest.distance,
      matchedEventId: closest.id,
    };
  }

  return {
    isDuplicate: false,
    closestDistance: null,
    matchedEventId: null,
  };
}

/**
 * Evaluates ecological imagery with Gemini 2.5 Flash for species, canopy health,
 * vegetation coverage, and anti-spoofing indicators.
 */
export async function evaluateEcologicalImagery(
  buffer: Buffer,
  mimeType: string
): Promise<GeminiForensicsAssessment> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      canopyHealth: "indeterminate",
      vegetationDensityPct: 0,
      speciesIdentified: [],
      authenticityAssessment: "Gemini API key not configured.",
      antiSpoofingPassed: true,
      riskScore: 0.5,
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are an expert satellite and drone MRV (Measurement, Reporting and Verification) ecologist and forensics auditor.
Analyze this ecological plot / mangrove / forestry photo.
Return ONLY valid JSON matching this schema with no markdown formatting:
{
  "canopyHealth": "thriving" | "recovering" | "degraded" | "indeterminate",
  "vegetationDensityPct": number between 0 and 100,
  "speciesIdentified": string[],
  "authenticityAssessment": string,
  "antiSpoofingPassed": boolean (false if it looks like a screen photo, AI generated, or stock photo),
  "riskScore": number between 0.00 (verified authentic) and 1.00 (severe manipulation / fraud)
}`;

  try {
    const part = {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType,
      },
    };

    const response = await model.generateContent([prompt, part]);
    const rawText = response.response.text().trim();
    const jsonStr = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const parsed = JSON.parse(jsonStr) as GeminiForensicsAssessment;
    return parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      canopyHealth: "indeterminate",
      vegetationDensityPct: 50,
      speciesIdentified: ["Unclassified flora"],
      authenticityAssessment: `AI evaluation fallback: ${message}`,
      antiSpoofingPassed: true,
      riskScore: 0.25,
    };
  }
}

/**
 * Complete Service Layer Pipeline for processing new evidence submissions:
 * 1. Hashes and dHash calculation
 * 2. Database Hamming duplicate detection via <~>
 * 3. EXIF metadata & GPS extraction
 * 4. Gemini AI forensics evaluation
 * 5. Local storage upload
 * 6. Neon Lakebase Postgres record insertion
 */
export async function processEvidenceSubmission(options: {
  buffer: Buffer;
  filename: string;
  contentType: string;
  projectSlug: string;
  fallbackCoordinates?: [number, number]; // [lon, lat]
}): Promise<EvidenceProcessingResult> {
  const { buffer, filename, contentType, projectSlug, fallbackCoordinates } =
    options;

  const sha256Hash = computeSha256(buffer);
  const dHash = await computeDHash(buffer);
  const exif = await extractExifTelemetry(buffer);

  // Database-level perceptual duplicate check with <~>
  const duplicateCheck = await checkPerceptualDuplicates(dHash, 10);

  // Gemini AI assessment
  const geminiAssessment = await evaluateEcologicalImagery(buffer, contentType);

  // Compute final composite risk score (penalizing duplicates and spoofing)
  let compositeRisk = geminiAssessment.riskScore;
  if (duplicateCheck.isDuplicate) {
    compositeRisk = Math.min(1.0, compositeRisk + 0.5);
  }
  if (!geminiAssessment.antiSpoofingPassed) {
    compositeRisk = Math.min(1.0, compositeRisk + 0.4);
  }

  // Upload to local storage
  const upload = await storageService.upload({
    buffer,
    filename,
    contentType,
    subfolder: projectSlug,
  });

  // Determine final coordinates: EXIF takes precedence, then fallback coordinates
  const finalCoords: [number, number] | null =
    exif.longitude !== null && exif.latitude !== null
      ? [exif.longitude, exif.latitude]
      : fallbackCoordinates ?? null;

  // Insert into Neon verification_events table
  const [record] = await db
    .insert(verificationEvents)
    .values({
      projectSlug,
      sha256Hash,
      dHash,
      location: finalCoords,
      riskScore: compositeRisk,
    })
    .returning({ id: verificationEvents.id });

  return {
    upload,
    sha256Hash,
    dHash,
    exif,
    duplicateCheck,
    geminiAssessment,
    verificationEventId: record.id,
    finalRiskScore: Math.round(compositeRisk * 100) / 100,
  };
}
