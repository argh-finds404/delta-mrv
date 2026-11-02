-- Hand-written. Every index in docs/03-DATABASE.md §6, and only those; the
-- generated schema declares none of them.

-- ST_Covers, ST_DWithin on the exact boundary
CREATE INDEX project_private_location_boundary_gist ON project_private_location USING gist (boundary);
--> statement-breakpoint
-- duplicate search: dhash <~> $1::bit(64)
CREATE INDEX evidence_file_dhash_hnsw ON evidence_file USING hnsw (dhash bit_hamming_ops);
--> statement-breakpoint
-- one BEFORE and one AFTER per round; SUPPLEMENT rows are unconstrained
CREATE UNIQUE INDEX evidence_file_submission_role_round_uidx ON evidence_file (submission_id, role, round) WHERE role IN ('BEFORE', 'AFTER');
--> statement-breakpoint
CREATE UNIQUE INDEX review_decision_submission_round_reviewer_uidx ON review_decision (submission_id, round, reviewer_user_id);
--> statement-breakpoint
CREATE UNIQUE INDEX project_funder_project_funder_uidx ON project_funder (project_id, funder_org_id);
--> statement-breakpoint
CREATE UNIQUE INDEX project_assignment_project_verifier_uidx ON project_assignment (project_id, verifier_org_id);
--> statement-breakpoint
CREATE UNIQUE INDEX anchor_leaf_submission_version_uidx ON anchor_leaf (submission_id, manifest_version);
--> statement-breakpoint
CREATE UNIQUE INDEX job_idempotency_key_uidx ON job (idempotency_key);
--> statement-breakpoint
-- SKIP LOCKED queue poll
CREATE INDEX job_status_run_at_idx ON job (status, run_at);
--> statement-breakpoint
-- chain head lookup
CREATE INDEX audit_event_org_seq_desc_idx ON audit_event (org_id, seq DESC);
--> statement-breakpoint
-- Lab queue
CREATE INDEX evidence_submission_project_status_idx ON evidence_submission (project_id, status);
--> statement-breakpoint
-- tenancy filter
CREATE INDEX evidence_submission_owner_org_idx ON evidence_submission (owner_org_id);
