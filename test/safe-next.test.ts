import { describe, expect, it } from "vitest";
import { safeNext, signInRedirect } from "../src/lib/safe-next";

describe("safeNext", () => {
  it.each(["/lab", "/lab?queue=high", "/projects/abc/submit", "/submissions/123#findings"])("keeps %s", (p) => {
    expect(safeNext(p)).toBe(p);
  });

  it.each([
    ["an absolute URL", "https://evil.example/lab"],
    ["a protocol-relative URL", "//evil.example/lab"],
    ["a backslash host", String.raw`/\evil.example`],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a path without a leading slash", "lab"],
    ["a tab smuggled after the slash", "/\t/evil.example"],
    ["a newline", "/lab\nSet-Cookie: x=1"],
    ["an empty string", ""],
  ])("rejects %s", (_name, value) => {
    expect(safeNext(value)).toBeNull();
  });

  it("rejects null and undefined", () => {
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });

  it.each(["/sign-in", "/sign-in?next=%2Flab", "/sign-up", "/demo"])("will not send someone back to the auth page %s", (p) => {
    expect(safeNext(p)).toBeNull();
  });

  it("does not mistake a similar path for an auth page", () => {
    expect(safeNext("/sign-installer")).toBe("/sign-installer");
    expect(safeNext("/demonstration")).toBe("/demonstration");
  });
});

describe("signInRedirect", () => {
  it("carries the path and the query, encoded", () => {
    expect(signInRedirect("/lab")).toBe("/sign-in?next=%2Flab");
    expect(signInRedirect("/lab", "?a=1&b=2")).toBe("/sign-in?next=%2Flab%3Fa%3D1%26b%3D2");
  });

  it("round-trips through safeNext", () => {
    const url = new URL(signInRedirect("/projects/p1/submit", "?step=2"), "http://localhost");
    expect(safeNext(url.searchParams.get("next"))).toBe("/projects/p1/submit?step=2");
  });
});
