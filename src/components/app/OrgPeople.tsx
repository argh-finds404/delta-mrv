"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { authClient } from "@/src/lib/auth-client";
import type { OrgType } from "@/src/lib/org-type";

type Member = { id: string; role: string; user: { name: string; email: string } };
type Invitation = { id: string; email: string; role: string; status: string; expiresAt: string | Date };
type Role = "member" | "admin";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Administrator", member: "Member" };

// what each role can do here, said once under the choice (docs/04-AUTH.md §2)
const ROLE_HELP: Record<OrgType, Record<Role, string>> = {
  OWNER: { member: "A member sends evidence for the organisation's projects.", admin: "An administrator also registers and manages projects, and invites people." },
  VERIFIER: {
    member: "A member reviews submissions and votes on them.",
    admin: "An administrator also takes projects on for review, runs anchoring, invites people, and casts the deciding vote when two reviewers disagree.",
  },
  FUNDER: { member: "A member reads the verified outcomes of the projects the organisation funds.", admin: "An administrator also invites people." },
};

const field = "h-11 w-full rounded-xl border border-field-hairline bg-white px-3 text-[15px] focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20";
const quiet =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-field-hairline px-3 text-[14px] transition-colors hover:border-field-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-55";
const until = (d: string | Date) => `${new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`;

/**
 * Who is in the organisation, and how a colleague joins it (docs/16-AMENDMENTS-v2.md A14): there
 * is no email, so an owner or administrator records an invitation for an address and passes on a
 * link, shown once. Every rule is the auth service's: who may invite, and that only the invited
 * address can use the link.
 */
export function OrgPeople({ orgId, orgName, orgType }: { orgId: string; orgName: string; orgType: OrgType }) {
  const [members, setMembers] = React.useState<Member[] | null>(null);
  const [invitations, setInvitations] = React.useState<Invitation[]>([]);
  const [loadError, setLoadError] = React.useState(false);
  const [role, setRole] = React.useState<Role>("member");
  const [error, setError] = React.useState<string | null>(null);
  const [made, setMade] = React.useState<{ email: string; link: string; expiresAt: string | Date } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let ignore = false;
    void Promise.all([authClient.organization.listMembers({ query: { organizationId: orgId } }), authClient.organization.listInvitations({ query: { organizationId: orgId } })]).then(
      ([m, i]) => {
        if (ignore) return;
        if (m.error || i.error) return setLoadError(true);
        setLoadError(false);
        setMembers((m.data?.members ?? []) as Member[]);
        setInvitations(((i.data ?? []) as Invitation[]).filter((inv) => inv.status === "pending" && new Date(inv.expiresAt) > new Date()));
      },
      () => !ignore && setLoadError(true),
    );
    return () => {
      ignore = true;
    };
  }, [orgId, reloadKey]);

  // onSubmit, not a form action: React empties the fields after an action
  const invite = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim();
    start(async () => {
      setError(null);
      setMade(null);
      setCopied(false);
      const res = await authClient.organization.inviteMember({ email, role, organizationId: orgId }).catch(() => null);
      if (!res || res.error || !res.data) return setError(res?.error?.message ?? "The invitation could not be recorded. Check your connection and try again.");
      setMade({ email, link: `${window.location.origin}/dashboard?invite=${res.data.id}`, expiresAt: res.data.expiresAt });
      form.reset();
      setReloadKey((k) => k + 1);
    });
  };

  const cancel = (id: string) =>
    start(async () => {
      const res = await authClient.organization.cancelInvitation({ invitationId: id }).catch(() => null);
      if (!res || res.error) return setError("The invitation could not be cancelled. Try again.");
      setMade(null);
      setReloadKey((k) => k + 1);
    });

  return (
    <section aria-labelledby="people" className="rise-in max-w-[760px] space-y-6">
      <h2 id="people" className="font-serif text-[28px] leading-tight tracking-[-0.01em]">
        People in {orgName}
      </h2>

      {loadError ? (
        <p role="alert" className="text-[15px] text-field-muted">
          The list of people could not be loaded.{" "}
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="underline underline-offset-4">
            Try again
          </button>
        </p>
      ) : members === null ? null : (
        <ul className="divide-y divide-field-hairline rounded-2xl border border-field-hairline bg-field-canopy">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-3 text-[15px]">
              <span className="min-w-0">
                <span className="font-medium">{m.user.name}</span> <span className="break-all text-[14px] text-field-muted">{m.user.email}</span>
              </span>
              <span className="text-[14px] text-field-muted">{ROLE_LABEL[m.role] ?? m.role}</span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={invite} className="space-y-4 rounded-2xl border border-field-hairline bg-field-canopy p-5">
        <h3 className="text-[16px] font-medium">Invite a colleague</h3>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
          <label className="block space-y-1.5 text-[14px] font-medium">
            Their email address
            <input name="email" type="email" required autoComplete="off" placeholder="name@organisation.org" className={field} />
          </label>
          <label className="block space-y-1.5 text-[14px] font-medium">
            They join as
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={field}>
              <option value="member">Member</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
        </div>
        <p className="text-[14px] leading-[1.6] text-field-muted">{ROLE_HELP[orgType][role]}</p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center rounded-xl bg-signal px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#14543D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-55"
        >
          {pending ? "Recording…" : "Create the invitation link"}
        </button>
        {error && (
          <p role="alert" className="text-[14px] text-fraud">
            {error}
          </p>
        )}
        {made && (
          <div role="status" className="space-y-3 rounded-xl border border-field-hairline bg-field-raised p-4 text-[14px] leading-[1.6]" data-testid="invitation-made">
            <p>
              Send this link to <span className="font-medium">{made.email}</span> yourself: Delta sends no email. It works once, only for an account with that address, until {until(made.expiresAt)}.
            </p>
            <p className="break-all rounded-lg border border-field-hairline bg-white px-3 py-2 font-mono text-[13px]" data-testid="invitation-link">
              {made.link}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(made.link).then(() => setCopied(true), () => setCopied(false))}
                className={quiet}
              >
                {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied ? "Copied" : "Copy the link"}
              </button>
              <span className="text-field-muted">It is shown this once. If it is lost, cancel the invitation below and make a new one.</span>
            </div>
          </div>
        )}
      </form>

      {invitations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[16px] font-medium">Invitations not used yet</h3>
          <ul className="divide-y divide-field-hairline rounded-2xl border border-field-hairline bg-field-canopy">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 text-[14px]">
                <span className="min-w-0">
                  <span className="break-all text-[15px] font-medium">{inv.email}</span>{" "}
                  <span className="text-field-muted">
                    as {(ROLE_LABEL[inv.role] ?? inv.role).toLowerCase()}, until {until(inv.expiresAt)}
                  </span>
                </span>
                <button type="button" disabled={pending} onClick={() => cancel(inv.id)} className={quiet}>
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
