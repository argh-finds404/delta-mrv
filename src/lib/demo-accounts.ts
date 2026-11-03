// The seeded demo accounts (scripts/seed.ts, docs/04-AUTH.md §8). Shared by the seed and by
// the demo sign-in action, and imported by neither client code nor anything that ships the
// password to a browser. Demo databases only; the seed refuses to run against production.
export const DEMO_PASSWORD = "delta-demo-2026";

/** Persona id (the demo page) -> seeded account email. The client sends the id, never the email. */
export const DEMO_PERSONA_EMAILS: Readonly<Record<string, string>> = {
  "persona-owner": "submitter@delta-demo.example",
  "persona-verifier-1": "verifier1@delta-demo.example",
  "persona-verifier-2": "verifier2@delta-demo.example",
  "persona-funder": "funder@delta-demo.example",
};
