"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";

const ROLE = { owner: "an owner", admin: "an administrator", member: "a member" } as const;

type State =
  | { kind: "loading" }
  | { kind: "ready"; organizationName: string; role: string }
  | { kind: "gone"; message: string };

/**
 * The far end of an invitation link (/dashboard?invite=<id>). The invitation is read and accepted
 * by the auth service, which gives it only to the account whose address it was made for.
 */
export function JoinInvitation({ invitationId, signedInAs }: { invitationId: string; signedInAs: string }) {
  const router = useRouter();
  const [state, setState] = React.useState<State>({ kind: "loading" });
  const [pending, start] = React.useTransition();

  React.useEffect(() => {
    let ignore = false;
    void authClient.organization.getInvitation({ query: { id: invitationId } }).then(
      (res) => {
        if (ignore) return;
        if (res.data) return setState({ kind: "ready", organizationName: res.data.organizationName, role: res.data.role });
        setState({
          kind: "gone",
          message:
            res.error?.status === 403
              ? `This invitation was made for a different email address. You are signed in as ${signedInAs}. Sign in with the address it was made for, or ask for a new invitation.`
              : "This invitation has expired, was cancelled, or has already been used. Ask the person who invited you for a new link.",
        });
      },
      () => !ignore && setState({ kind: "gone", message: "The invitation could not be read. Check your connection and open the link again." }),
    );
    return () => {
      ignore = true;
    };
  }, [invitationId, signedInAs]);

  if (state.kind === "loading") return null; // nothing below 200 ms, and no skeleton for a card that may not appear (docs/15 §3)

  return (
    <section aria-labelledby="invitation" className="rise-in max-w-[640px] space-y-3 rounded-2xl border border-field-hairline bg-field-canopy p-8">
      <h2 id="invitation" className="font-serif text-[28px] leading-tight">
        {state.kind === "ready" ? `Join ${state.organizationName}` : "This invitation cannot be used"}
      </h2>
      {state.kind === "ready" ? (
        <>
          <p className="text-[15px] leading-[1.6] text-field-muted">
            You were invited to join {state.organizationName} as {ROLE[state.role as keyof typeof ROLE] ?? "a member"}. Joining lets you work on its projects under your own name.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await authClient.organization.acceptInvitation({ invitationId }).catch(() => null);
                if (!res || res.error) return setState({ kind: "gone", message: "The invitation could not be accepted. It may have expired or been cancelled. Ask for a new link." });
                router.replace("/dashboard");
                router.refresh();
              })
            }
            className="inline-flex h-11 items-center rounded-xl bg-signal px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#14543D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-55"
          >
            {pending ? "Joining…" : `Join ${state.organizationName}`}
          </button>
        </>
      ) : (
        <p role="alert" className="text-[15px] leading-[1.6]">
          {state.message}
        </p>
      )}
    </section>
  );
}
