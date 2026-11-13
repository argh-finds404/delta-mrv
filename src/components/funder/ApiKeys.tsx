"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";

export interface ApiKeyRow {
  id: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

type Create = (orgId: string) => Promise<{ ok: true; key: string } | { ok: false; error: string }>;
type Revoke = (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const button = "inline-flex h-10 items-center gap-2 rounded-xl border border-field-hairline px-3.5 text-[14px] transition-colors hover:border-field-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-55";

/** Read-only API keys for the funder's organisation: make one (shown once), try it, revoke it. */
export function ApiKeys({ orgId, keys, create, revoke }: { orgId: string; keys: ApiKeyRow[]; create: Create; revoke: Revoke }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [fresh, setFresh] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reply, setReply] = React.useState<string | null>(null);
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setOrigin(window.location.origin), 0);
    return () => clearTimeout(t);
  }, []);

  const curl = `curl -H "Authorization: Bearer ${fresh ?? "dmrv_<your key>"}" ${origin}/api/v1/stats`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-[60ch] text-[15px] leading-[1.6] text-field-muted">
          A key reads this organisation&apos;s portfolio numbers from the API and can change nothing. Only a fingerprint of it is stored, so it is shown once, here, when you make it.
        </p>
        <button
          type="button"
          disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-signal px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#14543D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-55"
          onClick={() =>
            start(async () => {
              setError(null);
              setReply(null);
              const res = await create(orgId);
              if (res.ok) setFresh(res.key);
              else setError(res.error);
              router.refresh();
            })
          }
        >
          <KeyRound className="size-[18px]" aria-hidden />
          New API key
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[14px] text-fraud">
          {error}
        </p>
      )}

      {fresh && (
        <div className="space-y-2 rounded-2xl border border-field-hairline bg-field-raised p-4">
          <p className="text-[14px] font-medium">Your new key. Copy it now: it cannot be shown again.</p>
          <code data-testid="api-key-secret" className="block break-all font-mono text-[13px]">
            {fresh}
          </code>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[14px] text-field-muted">Read the portfolio from a terminal:</p>
        <pre className="overflow-x-auto rounded-xl border border-field-hairline bg-field-raised p-3 font-mono text-[13px] leading-[1.6] whitespace-pre-wrap break-all">{curl}</pre>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!fresh || pending}
            className={button}
            onClick={() =>
              start(async () => {
                const res = await fetch("/api/v1/stats", { headers: { authorization: `Bearer ${fresh}` }, cache: "no-store" });
                setReply(`HTTP ${res.status}\n${JSON.stringify(await res.json(), null, 2)}`);
              })
            }
          >
            Run it here
          </button>
          {!fresh && <span className="text-[13px] text-field-muted">Make a key to try the request from this page.</span>}
        </div>
        {reply && (
          <pre data-testid="api-key-reply" className="max-h-72 overflow-auto rounded-xl border border-field-hairline bg-field-raised p-3 font-mono text-[12px] leading-[1.6]">
            {reply}
          </pre>
        )}
      </div>

      {keys.length > 0 && (
        <ul className="divide-y divide-field-hairline rounded-2xl border border-field-hairline bg-field-canopy">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[14px]">
              <span className="font-mono">dmrv_{k.keyPrefix}_…</span>
              <span className="text-field-muted">
                Made {day(k.createdAt)}
                {k.lastUsedAt ? `, last used ${day(k.lastUsedAt)}` : ", never used"}
              </span>
              {k.revokedAt ? (
                <span className="text-field-muted">Revoked {day(k.revokedAt)}</span>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  className={button}
                  onClick={() =>
                    start(async () => {
                      const res = await revoke(k.id);
                      if (!res.ok) setError(res.error);
                      if (fresh?.startsWith(`dmrv_${k.keyPrefix}_`)) setFresh(null);
                      router.refresh();
                    })
                  }
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
