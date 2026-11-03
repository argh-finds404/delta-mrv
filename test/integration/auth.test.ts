import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { member, organization, user } from "../../src/server/db/schema";
import { db } from "./db";

const { auth } = await import("../../src/server/auth");
const { queryClient } = await import("../../src/server/db/client");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const tag = `${Date.now()}`;
const email = `auth-smoke-${tag}@example.test`;
const created: { userIds: string[]; orgIds: string[] } = { userIds: [], orgIds: [] };

// Better Auth runs on its own connection, so these rows are really committed.
// Remove them by hand; the cascade clears session, account and member.
afterAll(async () => {
  if (created.orgIds.length) await db.delete(organization).where(inArray(organization.id, created.orgIds));
  if (created.userIds.length) await db.delete(user).where(inArray(user.id, created.userIds));
  await queryClient.end();
});

async function signIn() {
  const res = await auth.api.signInEmail({
    body: { email, password: "correct-horse-battery" },
    returnHeaders: true,
  });
  return new Headers({ cookie: res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") });
}

describe("auth: Better Auth against the hand-ported tables", () => {
  it("signs up, creates an org with org_type, and keeps uuid ids end to end", async () => {
    const signUp = await auth.api.signUpEmail({
      body: { name: "Auth Smoke", email, password: "correct-horse-battery" },
      returnHeaders: true,
    });
    created.userIds.push(signUp.response.user.id);
    expect(signUp.response.user.id).toMatch(UUID);

    const cookie = signUp.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const headers = new Headers({ cookie });

    const org = await auth.api.createOrganization({
      body: { name: `Smoke Org ${tag}`, slug: `smoke-${tag}`, orgType: "OWNER" },
      headers,
    });
    created.orgIds.push(org!.id);
    expect(org!.id).toMatch(UUID);

    const [row] = await db.select().from(organization).where(eq(organization.id, org!.id));
    expect(row!.orgType).toBe("OWNER"); // landed in the org_type enum column

    const [membership] = await db.select().from(member).where(eq(member.organizationId, org!.id));
    expect(membership).toMatchObject({ userId: signUp.response.user.id, role: "owner" });

    // session.active_organization_id is a uuid column here (the CLI emits text)
    await auth.api.setActiveOrganization({ body: { organizationId: org!.id }, headers });
    const session = await auth.api.getSession({ headers });
    expect(session!.session.id).toMatch(UUID);
    expect(session!.session.activeOrganizationId).toBe(org!.id);
  });

  it("rejects an organisation with a missing or unknown org_type", async () => {
    const headers = await signIn();
    // Raw HTTP, so the request can be malformed in ways the typed API will not allow.
    const create = (body: object) =>
      auth.handler(
        new Request(`${process.env.BETTER_AUTH_URL}/api/auth/organization/create`, {
          method: "POST",
          headers: {
            cookie: headers.get("cookie")!,
            "content-type": "application/json",
            origin: new URL(process.env.BETTER_AUTH_URL!).origin,
          },
          body: JSON.stringify(body),
        }),
      );

    // 400, not 500: refused before the enum column is ever reached
    expect((await create({ name: "No Type", slug: `no-type-${tag}` })).status).toBe(400);
    expect((await create({ name: "Bad Type", slug: `bad-type-${tag}`, orgType: "BOGUS" })).status).toBe(400);

    const rows = await db.select().from(organization).where(inArray(organization.slug, [`no-type-${tag}`, `bad-type-${tag}`]));
    expect(rows).toEqual([]);
  });

  it("refuses to change org_type on update", async () => {
    const headers = await signIn();
    const orgId = created.orgIds[0]!;

    await expect(
      auth.api.updateOrganization({
        body: { organizationId: orgId, data: { orgType: "VERIFIER" } },
        headers,
      }),
    ).rejects.toThrow(/org_type cannot be changed/);

    const [row] = await db.select().from(organization).where(eq(organization.id, orgId));
    expect(row!.orgType).toBe("OWNER");
  });
});
