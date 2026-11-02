CREATE TYPE "public"."org_type" AS ENUM('OWNER', 'VERIFIER', 'FUNDER');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('MANGROVE', 'WETLAND', 'RIVER_CLEANUP', 'TREE_PLANTING', 'COASTAL_BELT');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('DRAFT', 'ACTIVE', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."evidence_role" AS ENUM('BEFORE', 'AFTER', 'SUPPLEMENT');--> statement-breakpoint
CREATE TYPE "public"."finding_kind" AS ENUM('EXACT_DUPLICATE_SAME_PROJECT', 'EXACT_DUPLICATE_SAME_ORG', 'EXACT_DUPLICATE_OTHER_ORG', 'PERCEPTUAL_MATCH_SAME_PROJECT', 'PERCEPTUAL_MATCH_SAME_ORG', 'PERCEPTUAL_MATCH_OTHER_ORG', 'GPS_INSIDE_BOUNDARY', 'GPS_WITHIN_TOLERANCE', 'GPS_OUTSIDE_BOUNDARY', 'GPS_MISSING', 'EXIF_TIMESTAMP_MISSING', 'EXIF_TIMESTAMP_IMPLAUSIBLE', 'EXIF_FULLY_STRIPPED', 'NO_VISIBLE_CHANGE', 'CLIENT_HASH_MISMATCH', 'AI_OBSERVATION');--> statement-breakpoint
CREATE TYPE "public"."risk_band" AS ENUM('clear', 'review', 'concern');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('INFO', 'LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('DRAFT', 'PENDING_FORENSICS', 'IN_REVIEW', 'NEEDS_MORE_PROOF', 'ESCALATED', 'APPROVED', 'REJECTED', 'ANCHORED');--> statement-breakpoint
CREATE TYPE "public"."decision" AS ENUM('APPROVE', 'REJECT', 'REQUEST_MORE_PROOF');--> statement-breakpoint
CREATE TYPE "public"."anchor_status" AS ENUM('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('PENDING', 'RUNNING', 'DONE', 'FAILED', 'STUCK');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	"org_type" "org_type" NOT NULL,
	"country" text,
	"website" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"active_organization_id" uuid,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impact_project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"activity_type" "activity_type" NOT NULL,
	"claimed_quantity" numeric,
	"claimed_unit" text,
	"fuzzed_centroid" "geography",
	"location_commitment" char(64),
	"tolerance_meters" integer DEFAULT 100 NOT NULL,
	"status" "project_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"verifier_org_id" uuid NOT NULL,
	"assigned_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_funder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"funder_org_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_private_location" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"boundary" "geography" NOT NULL,
	"location_salt" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"role" "evidence_role" NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" char(64) NOT NULL,
	"client_sha256" char(64),
	"dhash" bit(64),
	"exif" jsonb,
	"gps" "geography",
	"captured_at" timestamp with time zone,
	"round" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"submitted_by_user_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"status" "submission_status" DEFAULT 'DRAFT' NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"risk_score" numeric,
	"risk_band" "risk_band",
	"scoring_version" text,
	"manifest" jsonb,
	"manifest_hash" char(64),
	"manifest_version" integer DEFAULT 1 NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forensic_finding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"evidence_file_id" uuid,
	"kind" "finding_kind" NOT NULL,
	"severity" "severity" NOT NULL,
	"reason" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"rule_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"seq" bigint NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"prev_event_hash" char(64) NOT NULL,
	"event_hash" char(64) NOT NULL,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_event_org_id_seq_unique" UNIQUE("org_id","seq")
);
--> statement-breakpoint
CREATE TABLE "review_decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"reviewer_user_id" uuid NOT NULL,
	"reviewer_org_id" uuid NOT NULL,
	"decision" "decision" NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_decision_reason_min_length" CHECK (char_length("review_decision"."reason") >= 20)
);
--> statement-breakpoint
CREATE TABLE "anchor_batch" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "anchor_batch_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"merkle_root" char(66) NOT NULL,
	"chain_id" integer NOT NULL,
	"contract_address" char(42) NOT NULL,
	"tx_hash" char(66),
	"block_number" bigint,
	"status" "anchor_status" DEFAULT 'PENDING' NOT NULL,
	"leaf_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "anchor_leaf" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" bigint NOT NULL,
	"submission_id" uuid NOT NULL,
	"manifest_hash" char(64) NOT NULL,
	"manifest_version" integer NOT NULL,
	"leaf_index" integer NOT NULL,
	"proof" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" char(64) NOT NULL,
	"org_id" uuid NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "job_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_project" ADD CONSTRAINT "impact_project_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignment" ADD CONSTRAINT "project_assignment_project_id_impact_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."impact_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignment" ADD CONSTRAINT "project_assignment_verifier_org_id_organization_id_fk" FOREIGN KEY ("verifier_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignment" ADD CONSTRAINT "project_assignment_assigned_by_user_id_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_funder" ADD CONSTRAINT "project_funder_project_id_impact_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."impact_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_funder" ADD CONSTRAINT "project_funder_funder_org_id_organization_id_fk" FOREIGN KEY ("funder_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_funder" ADD CONSTRAINT "project_funder_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_private_location" ADD CONSTRAINT "project_private_location_project_id_impact_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."impact_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_file" ADD CONSTRAINT "evidence_file_submission_id_evidence_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."evidence_submission"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_submission" ADD CONSTRAINT "evidence_submission_project_id_impact_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."impact_project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_submission" ADD CONSTRAINT "evidence_submission_submitted_by_user_id_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_submission" ADD CONSTRAINT "evidence_submission_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forensic_finding" ADD CONSTRAINT "forensic_finding_submission_id_evidence_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."evidence_submission"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forensic_finding" ADD CONSTRAINT "forensic_finding_evidence_file_id_evidence_file_id_fk" FOREIGN KEY ("evidence_file_id") REFERENCES "public"."evidence_file"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decision" ADD CONSTRAINT "review_decision_submission_id_evidence_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."evidence_submission"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decision" ADD CONSTRAINT "review_decision_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decision" ADD CONSTRAINT "review_decision_reviewer_org_id_organization_id_fk" FOREIGN KEY ("reviewer_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anchor_leaf" ADD CONSTRAINT "anchor_leaf_batch_id_anchor_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."anchor_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anchor_leaf" ADD CONSTRAINT "anchor_leaf_submission_id_evidence_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."evidence_submission"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");