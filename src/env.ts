import "server-only";
import { z } from "zod";

// "" is how .env.example ships an unset variable, so it counts as unset.
const unsetIfEmpty = (v: unknown) => (v === "" ? undefined : v);
const hex = (bytes: number) => new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`);

const schema = z.object({
  DATABASE_URL: z.url(),
  DATABASE_URL_UNPOOLED: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  GEMINI_API_KEY: z.preprocess(unsetIfEmpty, z.string().min(1).optional()),
  GEMINI_MODEL: z.string().min(1),
  BASE_SEPOLIA_RPC_URL: z.url(),
  ANCHOR_PRIVATE_KEY: z.string().regex(hex(32)),
  ANCHOR_CONTRACT_ADDRESS: z.string().regex(hex(20)),
  NEXT_PUBLIC_CHAIN_ID: z.coerce.number().pipe(z.literal(84532)),
  NEXT_PUBLIC_CONTRACT_ADDRESS: z.string().regex(hex(20)),
  CRON_SECRET: z.string().min(1),
  DEMO_MODE: z.preprocess(unsetIfEmpty, z.literal("true").optional()),
});

// Listed one by one so Next can inline the NEXT_PUBLIC_* values.
const parsed = schema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  BASE_SEPOLIA_RPC_URL: process.env.BASE_SEPOLIA_RPC_URL,
  ANCHOR_PRIVATE_KEY: process.env.ANCHOR_PRIVATE_KEY,
  ANCHOR_CONTRACT_ADDRESS: process.env.ANCHOR_CONTRACT_ADDRESS,
  NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
  NEXT_PUBLIC_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
  CRON_SECRET: process.env.CRON_SECRET,
  DEMO_MODE: process.env.DEMO_MODE,
});

if (!parsed.success) {
  // Names and zod messages only: never echo a value, several are secrets.
  const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
  throw new Error(`Invalid environment, fix .env.local:\n${lines.join("\n")}`);
}

export const env = parsed.data;
