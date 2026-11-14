"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { createOrganisation, parseOrgDetails, type OrgDetails } from "@/src/components/auth/create-organisation";
import { authPrimary } from "@/src/components/auth/form-styles";
import { OrganisationFields } from "@/src/components/auth/OrganisationFields";
import { CurveLoader } from "@/src/components/motion/CurveLoader";
import { authClient } from "@/src/lib/auth-client";

type Stage = { kind: "working" } | { kind: "ask" } | { kind: "error"; message: string };

/**
 * Where an email confirmation link lands, signed in. The organisation chosen at sign-up rides along
 * in the link and is created now, once the address is proved. A link without it (one sent at
 * sign-in, say) asks for the organisation here. Someone who already belongs to one goes straight
 * on: opening a link twice creates nothing twice.
 */
export default function FinishSignUpPage() {
  const router = useRouter();
  const session = authClient.useSession();
  const [stage, setStage] = React.useState<Stage>({ kind: "working" });
  const [org, setOrg] = React.useState<OrgDetails>({ name: "", type: "OWNER", country: "Bangladesh", website: "" });
  const [nameError, setNameError] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);
  const started = React.useRef(false);
  const search = React.useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => "",
  );

  const create = React.useCallback(
    async (details: OrgDetails) => {
      const made = await createOrganisation(details);
      if (made.ok) router.replace("/dashboard");
      else setStage({ kind: "error", message: `Your email is confirmed, but the organisation was not created: ${made.error}.` });
    },
    [router],
  );

  React.useEffect(() => {
    if (!session.data || started.current) return;
    started.current = true;
    const details = parseOrgDetails(new URLSearchParams(window.location.search).get("org"));
    void (async () => {
      const orgs = await authClient.organization.list();
      if (orgs.data?.length) return router.replace("/dashboard");
      if (details) return create(details);
      setStage({ kind: "ask" });
    })();
  }, [session.data, router, create]);

  if (!session.isPending && !session.data) {
    return (
      <div className="space-y-5">
        <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em]">Sign in to finish</h1>
        <p className="text-[16px] leading-[1.6] text-field-muted">Your email is confirmed. Sign in and your organisation is set up.</p>
        <Link href={`/sign-in?next=${encodeURIComponent(`/sign-up/finish${search}`)}`} className={authPrimary}>
          Sign in <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    );
  }

  if (stage.kind === "ask") {
    return (
      <form
        method="post"
        noValidate
        className="space-y-6"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!org.name.trim()) return setNameError("Organisation name is required");
          setBusy(true);
          await create(org);
          setBusy(false);
        }}
      >
        <header className="space-y-3">
          <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em]">Register your organisation</h1>
          <p className="text-[16px] leading-[1.55] text-field-muted">Your email is confirmed. One step left: the organisation you work for.</p>
        </header>
        <OrganisationFields
          value={org}
          onChange={(p) => {
            setOrg((o) => ({ ...o, ...p }));
            if (p.name !== undefined) setNameError(undefined);
          }}
          error={nameError}
        />
        <button type="submit" disabled={busy} className={authPrimary}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {busy ? "Registering…" : "Register organisation"}
        </button>
      </form>
    );
  }

  return (
    <div role="status" className="space-y-5">
      <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em]">{stage.kind === "error" ? "Almost there" : "Email confirmed"}</h1>
      {stage.kind === "error" ? (
        <>
          <p role="alert" className="rounded-lg border border-fraud/40 bg-fraud/10 px-4 py-3 text-[15px]">
            {stage.message}
          </p>
          <button type="button" onClick={() => setStage({ kind: "ask" })} className={authPrimary}>
            Register the organisation again
          </button>
        </>
      ) : (
        <p className="flex items-center gap-2 text-[16px] text-field-muted">
          <CurveLoader />
          Setting up your account…
        </p>
      )}
    </div>
  );
}
