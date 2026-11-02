// Runs before every integration test file, before any import of src/env.ts.

// Explicit environment wins; .env.local only fills in what is missing.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local (CI, local Docker): the environment must already be set
}

// Integration tests write to a real database and must never reach production.
if (!process.env.NEON_BRANCH || process.env.NEON_BRANCH === "production") {
  throw new Error(`refusing to run integration tests: NEON_BRANCH is "${process.env.NEON_BRANCH ?? ""}"`);
}

// A constant (docs/07-DEPENDENCIES.md), required at boot by src/env.ts.
process.env.NEXT_PUBLIC_CHAIN_ID ||= "84532";
