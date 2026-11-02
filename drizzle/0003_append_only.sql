-- Hand-written. docs/03-DATABASE.md §5: append-only by revoked grants AND triggers.
-- The role must exist for REVOKE ... FROM app_user to run. NOLOGIN: this is a
-- grant target only; the connecting role is whatever DATABASE_URL names.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
-- TRUNCATE is a delete too, so it is revoked and blocked as well (beyond §5).
REVOKE UPDATE, DELETE, TRUNCATE ON review_decision, audit_event, anchor_leaf FROM PUBLIC;
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON review_decision, audit_event, anchor_leaf FROM app_user;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION delta_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only table: % is immutable', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_event_immutable
  BEFORE UPDATE OR DELETE ON audit_event
  FOR EACH ROW EXECUTE FUNCTION delta_block_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_event_no_truncate
  BEFORE TRUNCATE ON audit_event
  FOR EACH STATEMENT EXECUTE FUNCTION delta_block_mutation();
--> statement-breakpoint
CREATE TRIGGER review_decision_immutable
  BEFORE UPDATE OR DELETE ON review_decision
  FOR EACH ROW EXECUTE FUNCTION delta_block_mutation();
--> statement-breakpoint
CREATE TRIGGER review_decision_no_truncate
  BEFORE TRUNCATE ON review_decision
  FOR EACH STATEMENT EXECUTE FUNCTION delta_block_mutation();
--> statement-breakpoint
CREATE TRIGGER anchor_leaf_immutable
  BEFORE UPDATE OR DELETE ON anchor_leaf
  FOR EACH ROW EXECUTE FUNCTION delta_block_mutation();
--> statement-breakpoint
CREATE TRIGGER anchor_leaf_no_truncate
  BEFORE TRUNCATE ON anchor_leaf
  FOR EACH STATEMENT EXECUTE FUNCTION delta_block_mutation();
