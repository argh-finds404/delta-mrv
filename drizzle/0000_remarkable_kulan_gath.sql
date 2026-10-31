CREATE TABLE "verification_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_slug" text NOT NULL,
	"sha256_hash" text NOT NULL,
	"d_hash" bit(64),
	"location" geometry(Point, 4326),
	"risk_score" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
