-- Hand-written. drizzle-kit emits a bare "geography" column (it quotes custom
-- types it does not know, and "geography(Point, 4326)" is not an identifier), so
-- the typmod is applied here. Safe: no rows exist when this runs.
ALTER TABLE "impact_project" ALTER COLUMN "fuzzed_centroid" TYPE geography(Point, 4326);
--> statement-breakpoint
ALTER TABLE "project_private_location" ALTER COLUMN "boundary" TYPE geography(Polygon, 4326);
--> statement-breakpoint
ALTER TABLE "evidence_file" ALTER COLUMN "gps" TYPE geography(Point, 4326);
