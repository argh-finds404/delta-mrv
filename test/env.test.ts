import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID = {
  DATABASE_URL: "postgresql://u:p@host.example/db",
  DATABASE_URL_UNPOOLED: "postgresql://u:p@host.example/db",
  BETTER_AUTH_SECRET: "s".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  BLOB_READ_WRITE_TOKEN: "blob-token",
  GEMINI_API_KEY: "",
  GEMINI_MODEL: "model-name",
  BASE_SEPOLIA_RPC_URL: "https://rpc.example",
  ANCHOR_PRIVATE_KEY: `0x${"a".repeat(64)}`,
  ANCHOR_CONTRACT_ADDRESS: `0x${"b".repeat(40)}`,
  NEXT_PUBLIC_CHAIN_ID: "84532",
  NEXT_PUBLIC_CONTRACT_ADDRESS: `0x${"b".repeat(40)}`,
  CRON_SECRET: "cron",
  DEMO_MODE: "",
};

beforeEach(() => {
  vi.resetModules();
  for (const [k, v] of Object.entries(VALID)) vi.stubEnv(k, v);
});
afterEach(() => vi.unstubAllEnvs());

describe("env", () => {
  it("accepts a complete environment and treats empty optionals as unset", async () => {
    const { env } = await import("../src/env");
    expect(env.NEXT_PUBLIC_CHAIN_ID).toBe(84532);
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.DEMO_MODE).toBeUndefined();
  });

  it("fails loudly on a missing variable, naming it", async () => {
    vi.stubEnv("CRON_SECRET", "");
    await expect(import("../src/env")).rejects.toThrow(/CRON_SECRET/);
  });

  it("never echoes a secret value in the error", async () => {
    vi.stubEnv("ANCHOR_PRIVATE_KEY", "0xnot-a-valid-key-SECRETVALUE");
    const err = await import("../src/env").then(() => null, (e: Error) => e);
    expect(err?.message).toMatch(/ANCHOR_PRIVATE_KEY/);
    expect(err?.message).not.toMatch(/SECRETVALUE/);
  });
});
