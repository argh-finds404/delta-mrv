ALTER TYPE "public"."finding_kind" ADD VALUE 'SATELLITE_NDVI';--> statement-breakpoint
ALTER TABLE "evidence_submission" ADD COLUMN "capture_attestation" jsonb;