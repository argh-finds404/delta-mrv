// Regression (docs/SESSION-HANDOFF.md §7): a workspace page reached with a session cookie that
// has expired or is not valid sent the visitor to /sign-in with nowhere to come back to. The
// proxy passes the requested path on, and requireSession puts it in next=, as the proxy itself
// does when there is no cookie at all.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ requestHeaders: new Headers(), session: null as unknown }));
vi.mock("next/headers", () => ({ headers: async () => h.requestHeaders }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
vi.mock("../src/server/auth/index", () => ({ auth: { api: { getSession: async () => h.session } } }));

const { proxy } = await import("../src/proxy");
const { requireSession } = await import("../src/server/auth/session");
const { NEXT_HEADER } = await import("../src/lib/safe-next");

beforeEach(() => {
  h.requestHeaders = new Headers();
  h.session = null;
});

describe("a workspace page with a stale session cookie", () => {
  it("the proxy lets the request through and passes on the path and query asked for", () => {
    const res = proxy(new NextRequest("http://localhost:3000/lab?s=abc", { headers: { cookie: "better-auth.session_token=expired.value" } }));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get(`x-middleware-request-${NEXT_HEADER}`)).toBe("/lab?s=abc");
  });

  it("requireSession then redirects to sign-in with next= set to that page", async () => {
    h.requestHeaders.set(NEXT_HEADER, "/lab?s=abc");
    await expect(requireSession()).rejects.toThrow("REDIRECT /sign-in?next=%2Flab%3Fs%3Dabc");
  });

  it("drops anything that could leave the site, and still signs the visitor in", async () => {
    h.requestHeaders.set(NEXT_HEADER, "//evil.example/lab");
    await expect(requireSession()).rejects.toThrow(/^REDIRECT \/sign-in$/);
  });

  it("a valid session goes through untouched", async () => {
    h.session = { user: { id: "u1" } };
    await expect(requireSession()).resolves.toEqual({ user: { id: "u1" } });
  });
});

describe("a workspace page with no cookie at all", () => {
  it("is redirected by the proxy itself, next= included, as before", () => {
    const res = proxy(new NextRequest("http://localhost:3000/projects/p1/submit?drafts=1"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/sign-in?next=%2Fprojects%2Fp1%2Fsubmit%3Fdrafts%3D1");
  });
});
