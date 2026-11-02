import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BOOT = {
  DATABASE_URL: "postgresql://u:p@host.example/db",
  DATABASE_URL_UNPOOLED: "postgresql://u:p@host.example/db",
  BETTER_AUTH_SECRET: "s".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  NEXT_PUBLIC_CHAIN_ID: "84532",
};
const DEFERRED = [
  "BLOB_READ_WRITE_TOKEN",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "BASE_SEPOLIA_RPC_URL",
  "ANCHOR_PRIVATE_KEY",
  "ANCHOR_CONTRACT_ADDRESS",
  "NEXT_PUBLIC_CONTRACT_ADDRESS",
  "CRON_SECRET",
];

beforeEach(() => {
  vi.resetModules();
  for (const [k, v] of Object.entries(BOOT)) vi.stubEnv(k, v);
  for (const k of [...DEFERRED, "DEMO_MODE"]) vi.stubEnv(k, ""); // shipped-empty, like .env.example
});
afterEach(() => vi.unstubAllEnvs());

describe("env at boot", () => {
  it("boots with only the five boot variables; every deferred one may be empty", async () => {
    const { env } = await import("../src/env");
    expect(env.NEXT_PUBLIC_CHAIN_ID).toBe(84532);
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.DEMO_MODE).toBeUndefined();
  });

  it.each(Object.keys(BOOT))("fails loudly when %s is missing, naming it", async (name) => {
    vi.stubEnv(name, "");
    await expect(import("../src/env")).rejects.toThrow(new RegExp(name));
  });

  it("does not carry the deferred secrets on the env object", async () => {
    vi.stubEnv("ANCHOR_PRIVATE_KEY", `0x${"a".repeat(64)}`);
    const { env } = await import("../src/env");
    expect(env).not.toHaveProperty("ANCHOR_PRIVATE_KEY");
    expect(env).not.toHaveProperty("CRON_SECRET");
  });
});

describe("requireEnv", () => {
  it.each(DEFERRED)("throws at the point of use when %s is unset, naming it and the stage", async (name) => {
    const { requireEnv } = await import("../src/env");
    expect(() => requireEnv(name as never)).toThrow(new RegExp(`${name} is not set.*Stage \\d`));
  });

  it("returns a valid value", async () => {
    vi.stubEnv("CRON_SECRET", "cron");
    vi.stubEnv("ANCHOR_CONTRACT_ADDRESS", `0x${"b".repeat(40)}`);
    const { requireEnv } = await import("../src/env");
    expect(requireEnv("CRON_SECRET")).toBe("cron");
    expect(requireEnv("ANCHOR_CONTRACT_ADDRESS")).toBe(`0x${"b".repeat(40)}`);
  });

  it("never echoes a secret value in the error", async () => {
    vi.stubEnv("ANCHOR_PRIVATE_KEY", "0xnot-a-valid-key-SECRETVALUE");
    const { requireEnv } = await import("../src/env");
    const err = (() => {
      try {
        requireEnv("ANCHOR_PRIVATE_KEY");
      } catch (e) {
        return e as Error;
      }
    })();
    expect(err?.message).toMatch(/ANCHOR_PRIVATE_KEY is invalid/);
    expect(err?.message).not.toMatch(/SECRETVALUE/);
  });
});
