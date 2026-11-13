// Joining an organisation (docs/04-AUTH.md §2, docs/16-AMENDMENTS-v2.md A14): there is no email,
// so an owner or admin records an invitation for an address and hands over a link. This is the
// auth library's own invitation flow under this project's configuration; the test pins what the
// product relies on:
//   - only an owner or admin of the organisation can invite
//   - the invitation is used by an account with that address, and by no other
//   - it works without email verification (off in this build), because the link is unguessable
//   - a cancelled invitation is dead
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { invitation, member, organization, user } from "../../src/server/db/schema";
import { db } from "./db";

const { auth } = await import("../../src/server/auth");
const { queryClient } = await import("../../src/server/db/client");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const tag = `${Date.now()}`;
const PASSWORD = "correct-horse-battery";
const created: { userIds: string[]; orgIds: string[] } = { userIds: [], orgIds: [] };

// Better Auth runs on its own connection, so these rows are really committed. Remove them by
// hand; the cascade clears session, account, member and invitation.
afterAll(async () => {
  if (created.orgIds.length) await db.delete(organization).where(inArray(organization.id, created.orgIds));
  if (created.userIds.length) await db.delete(user).where(inArray(user.id, created.userIds));
  await queryClient.end();
});

async function account(name: string) {
  const email = `invite-${name}-${tag}@example.test`;
  const res = await auth.api.signUpEmail({ body: { name, email, password: PASSWORD }, returnHeaders: true });
  created.userIds.push(res.response.user.id);
  const headers = new Headers({ cookie: res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") });
  return { id: res.response.user.id, email, headers };
}

describe("invitations", () => {
  it("an owner invites an address; that account joins, no other can, and a plain member cannot invite", async () => {
    const owner = await account("owner");
    const org = await auth.api.createOrganization({ body: { name: `Invite Org ${tag}`, slug: `invite-${tag}`, orgType: "VERIFIER" }, headers: owner.headers });
    created.orgIds.push(org!.id);

    const inviteeEmail = `invite-reviewer-${tag}@example.test`;
    const sent = await auth.api.createInvitation({ body: { email: inviteeEmail, role: "member", organizationId: org!.id }, headers: owner.headers });
    expect(sent.id).toMatch(UUID); // the link's secret: a random uuid, not a counter
    expect(sent).toMatchObject({ email: inviteeEmail, role: "member", status: "pending" });
    const hoursLeft = (new Date(sent.expiresAt).getTime() - Date.now()) / 3_600_000;
    expect(hoursLeft).toBeGreaterThan(47);
    expect(hoursLeft).toBeLessThanOrEqual(48);

    // someone else who got hold of the link
    const stranger = await account("stranger");
    await expect(auth.api.acceptInvitation({ body: { invitationId: sent.id }, headers: stranger.headers })).rejects.toThrow();
    await expect(auth.api.getInvitation({ query: { id: sent.id }, headers: stranger.headers })).rejects.toThrow();
    expect(await db.select().from(member).where(and(eq(member.organizationId, org!.id), eq(member.userId, stranger.id)))).toEqual([]);

    // the invited address: a new account, never email-verified, joins with the role it was given
    const reviewer = await account("reviewer");
    expect(reviewer.email).toBe(inviteeEmail);
    expect(await auth.api.getInvitation({ query: { id: sent.id }, headers: reviewer.headers })).toMatchObject({ organizationName: `Invite Org ${tag}`, role: "member" });
    await auth.api.acceptInvitation({ body: { invitationId: sent.id }, headers: reviewer.headers });
    const [joined] = await db.select().from(member).where(and(eq(member.organizationId, org!.id), eq(member.userId, reviewer.id)));
    expect(joined).toMatchObject({ role: "member" });
    // used once
    await expect(auth.api.acceptInvitation({ body: { invitationId: sent.id }, headers: reviewer.headers })).rejects.toThrow();

    // a plain member cannot bring people in
    await expect(auth.api.createInvitation({ body: { email: `invite-nobody-${tag}@example.test`, role: "member", organizationId: org!.id }, headers: reviewer.headers })).rejects.toThrow();
    expect(await db.select().from(invitation).where(eq(invitation.email, `invite-nobody-${tag}@example.test`))).toEqual([]);
  });

  it("a cancelled invitation cannot be used", async () => {
    const owner = await account("owner2");
    const org = await auth.api.createOrganization({ body: { name: `Invite Org B ${tag}`, slug: `invite-b-${tag}`, orgType: "OWNER" }, headers: owner.headers });
    created.orgIds.push(org!.id);
    const late = await account("late");
    const sent = await auth.api.createInvitation({ body: { email: late.email, role: "admin", organizationId: org!.id }, headers: owner.headers });
    await auth.api.cancelInvitation({ body: { invitationId: sent.id }, headers: owner.headers });
    await expect(auth.api.acceptInvitation({ body: { invitationId: sent.id }, headers: late.headers })).rejects.toThrow();
    expect(await db.select().from(member).where(and(eq(member.organizationId, org!.id), eq(member.userId, late.id)))).toEqual([]);
  });
});
