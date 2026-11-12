import "server-only";

// Importing this module registers every job handler, so whatever drains the queue (the
// /api/internal/jobs/drain route, after() on intake) knows every kind of work. Each import
// registers its own handlers at module load.
import "./ai-audit.service";
import "./forensics.service";
import "./intake-jobs";
