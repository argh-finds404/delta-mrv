ALTER TYPE "public"."finding_kind" ADD VALUE 'CLAIM_CHECKED';--> statement-breakpoint
ALTER TYPE "public"."finding_kind" ADD VALUE 'CLAIM_EXCEEDS_AREA';--> statement-breakpoint
ALTER TYPE "public"."finding_kind" ADD VALUE 'CLAIM_DENSITY_IMPLAUSIBLE';--> statement-breakpoint
ALTER TABLE "impact_project" ADD COLUMN "checkup_months" integer;--> statement-breakpoint
ALTER TABLE "evidence_submission" ADD COLUMN "follows_submission_id" uuid;--> statement-breakpoint
ALTER TABLE "evidence_submission" ADD CONSTRAINT "evidence_submission_follows_submission_id_evidence_submission_id_fk" FOREIGN KEY ("follows_submission_id") REFERENCES "public"."evidence_submission"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_project" ADD CONSTRAINT "impact_project_checkup_months_range" CHECK ("checkup_months" IS NULL OR "checkup_months" BETWEEN 1 AND 60);--> statement-breakpoint
CREATE INDEX "evidence_submission_follows_idx" ON "evidence_submission" ("follows_submission_id") WHERE "follows_submission_id" IS NOT NULL;