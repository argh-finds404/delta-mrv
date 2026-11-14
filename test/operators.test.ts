import { afterEach, describe, expect, it, vi } from "vitest";
import { parseOperatorEmails } from "../src/lib/operators";

describe("OPERATOR_EMAILS", () => {
  it("is a set of lowercase addresses; blanks, spaces and non-addresses are ignored", () => {
    expect([...parseOperatorEmails(" Ops@Example.org, ,second@example.org,not-an-address ")]).toEqual(["ops@example.org", "second@example.org"]);
    expect(parseOperatorEmails(undefined).size).toBe(0);
    expect(parseOperatorEmails("").size).toBe(0);
  });
});

describe("OPERATOR_EMAILS at boot", () => {
  afterEach(() => vi.unstubAllEnvs());
  const boot = () => {
    vi.resetModules();
    for (const [k, v] of Object.entries({
      DATABASE_URL: "postgresql://host.example/db",
      DATABASE_URL_UNPOOLED: "postgresql://host.example/db",
      BETTER_AUTH_SECRET: "s".repeat(32),
      BETTER_AUTH_URL: "http://localhost:3000",
      NEXT_PUBLIC_CHAIN_ID: "84532",
      DEMO_MODE: "",
    }))
      vi.stubEnv(k, v);
  };

  it("refuses a list with a typo in it, naming the variable, so no operator is silently locked out", async () => {
    boot();
    vi.stubEnv("OPERATOR_EMAILS", "ops@example.org; second@example.org");
    await expect(import("../src/env")).rejects.toThrow(/OPERATOR_EMAILS/);
  });

  it("reads a valid list, and an empty one, through env.ts", async () => {
    boot();
    vi.stubEnv("OPERATOR_EMAILS", "Ops@example.org, second@example.org");
    const { operatorEmails } = await import("../src/env");
    expect([...operatorEmails()]).toEqual(["ops@example.org", "second@example.org"]);
    vi.stubEnv("OPERATOR_EMAILS", "");
    expect(operatorEmails().size).toBe(0);
  });
});
