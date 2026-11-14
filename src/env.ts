import "server-only";
import { z } from "zod";
import { parseOperatorEmails } from "./lib/operators";

// "" is how .env.example ships an unset variable, so it counts as unset.
const unsetIfEmpty = (v: unknown) => (v === "" ? undefined : v);
const hex = (bytes: number) => new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`);

// Needed to boot: the app cannot start, and every stage from 1 on uses them.
const bootSchema = z.object({
  DATABASE_URL: z.url(),
  DATABASE_URL_UNPOOLED: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  NEXT_PUBLIC_CHAIN_ID: z.coerce.number().pipe(z.literal(84532)),
  GEMINI_API_KEY: z.preprocess(unsetIfEmpty, z.string().min(1).optional()),
  DEMO_MODE: z.preprocess(unsetIfEmpty, z.literal("true").optional()),
  // comma-separated addresses; a typo would silently lock every operator out, so it fails boot
  OPERATOR_EMAILS: z.preprocess(
    unsetIfEmpty,
    z
      .string()
      .refine((v) => v.split(",").every((e) => !e.trim() || /^[^\s@,]+@[^\s@,]+$/.test(e.trim())), "must be email addresses separated by commas")
      .optional(),
  ),
  // the satellite cross-check (X1) calls a public archive only when this is "true"
  NDVI_ENABLED: z.preprocess(unsetIfEmpty, z.literal("true").optional()),
  // Email (verification and password reset). Resend's HTTP API, free tier, when both are set
  RESEND_API_KEY: z.preprocess(unsetIfEmpty, z.string().startsWith("re_", "must be a Resend API key (re_...)").optional()),
  EMAIL_FROM: z.preprocess(unsetIfEmpty, z.string().regex(/^([^<>]+<)?[^\s@<>]+@[^\s@<>]+>?$/, "must be an address, or Name <address>").optional()),
  // development only: write each email as a JSON file here instead of sending it (ignored in production)
  EMAIL_OUTBOX_DIR: z.preprocess(unsetIfEmpty, z.string().optional()),
});

// Belong to later stages. Absent at boot is fine; requireEnv asserts them where
// they are used, so the failure names the variable and the stage that needs it.
const deferred = {
  BLOB_READ_WRITE_TOKEN: { stage: 3, schema: z.string().min(1) },
  CRON_SECRET: { stage: 4, schema: z.string().min(1) },
  // keys the opaque matchRef on cross-organisation findings; rotating it changes every matchRef
  FORENSICS_MATCH_KEY: { stage: 4, schema: z.string().min(32) },
  GEMINI_API_KEY: { stage: 5, schema: z.string().min(1) },
  GEMINI_MODEL: { stage: 5, schema: z.string().min(1) },
  BASE_SEPOLIA_RPC_URL: { stage: 6, schema: z.url() },
  ANCHOR_PRIVATE_KEY: { stage: 6, schema: z.string().regex(hex(32)) },
  ANCHOR_CONTRACT_ADDRESS: { stage: 6, schema: z.string().regex(hex(20)) },
  NEXT_PUBLIC_CONTRACT_ADDRESS: { stage: 6, schema: z.string().regex(hex(20)) },
} as const;

export type DeferredEnvName = keyof typeof deferred;

// Listed one by one so Next can inline the NEXT_PUBLIC_* values.
const parsed = bootSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  DEMO_MODE: process.env.DEMO_MODE,
  OPERATOR_EMAILS: process.env.OPERATOR_EMAILS,
  NDVI_ENABLED: process.env.NDVI_ENABLED,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_OUTBOX_DIR: process.env.EMAIL_OUTBOX_DIR,
});

if (!parsed.success) {
  // Names and zod messages only: never echo a value, several are secrets.
  const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
  throw new Error(`Invalid environment, fix .env.local:\n${lines.join("\n")}`);
}

export const env = parsed.data;

/**
 * The operators' addresses (src/lib/operators.ts), lowercase. Read on every call rather than
 * taken from `env`, which is fixed at boot, so a test can list an operator for one case only;
 * the boot check above has already refused a malformed list.
 */
export function operatorEmails(): Set<string> {
  return parseOperatorEmails(process.env.OPERATOR_EMAILS);
}

/** A deferred variable, checked where it is used. Never put a value in the error. */
export function requireEnv(name: DeferredEnvName): string {
  const { stage, schema } = deferred[name];
  const raw = process.env[name];
  const result = schema.safeParse(raw === "" ? undefined : raw);
  if (!result.success) {
    const why = raw === undefined || raw === "" ? "is not set" : `is invalid (${result.error.issues[0]?.message})`;
    throw new Error(`Environment variable ${name} ${why}; it is needed from Stage ${stage}. See .env.example.`);
  }
  return result.data;
}
