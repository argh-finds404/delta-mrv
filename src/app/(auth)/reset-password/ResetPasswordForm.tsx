"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { DrawnIcon } from "@/src/components/motion/DrawnIcon";
import { authField, authLabel, authPrimary } from "@/src/components/auth/form-styles";
import { authClient } from "@/src/lib/auth-client";
import { cn } from "@/src/lib/utils";

const link = "text-field-text underline decoration-field-hairline underline-offset-[5px] transition-colors hover:decoration-field-text";

/** The new password, set with the token from the emailed link. Every other session of the account is signed out. */
export function ResetPasswordForm() {
  // read from the address bar, so the page needs no Suspense boundary; "" on the server
  const search = React.useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => "",
  );
  const params = new URLSearchParams(search);
  const token = params.get("token");
  const linkError = params.get("error");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);

  if (done) {
    return (
      <div role="status" className="space-y-5">
        <DrawnIcon mark="check" className="size-10 text-verified" />
        <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em]">Password changed</h1>
        <p className="text-[16px] leading-[1.6] text-field-muted">Every other device signed in to this account has been signed out.</p>
        <Link href="/sign-in" className={authPrimary}>
          Sign in <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    );
  }

  if (!token || linkError) {
    return (
      <div className="space-y-5">
        <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em]">This link no longer works</h1>
        <p className="text-[16px] leading-[1.6] text-field-muted">A reset link works once, for one hour. Ask for a new one.</p>
        <Link href="/forgot-password" className={link}>
          Send a new link
        </Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    setBusy(true);
    setError(null);
    try {
      const res = await authClient.resetPassword({ newPassword: password, token });
      if (!res.error) setDone(true);
      else if (res.error.code === "INVALID_TOKEN" || res.error.status === 400) setError("This link has expired or was already used. Ask for a new one.");
      else setError(res.error.message ?? "The password could not be changed.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em]">Choose a new password</h1>
        <p className="text-[16px] leading-[1.55] text-field-muted">At least 8 characters. Longer is stronger.</p>
      </header>
      <form method="post" onSubmit={submit} noValidate className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="new-password" className={authLabel}>
            New password
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "password-error" : undefined}
              className={cn(authField(Boolean(error)), "pr-12")}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              aria-pressed={show}
              className="absolute right-1.5 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-field-muted transition-colors hover:text-field-text focus-visible:outline-2 focus-visible:outline-signal"
            >
              {show ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
            </button>
          </div>
          {error && (
            <p id="password-error" role="alert" className="text-[14px] text-fraud">
              {error}{" "}
              {error.includes("new one") && (
                <Link href="/forgot-password" className={link}>
                  Send a new link
                </Link>
              )}
            </p>
          )}
        </div>
        <button type="submit" disabled={busy} className={authPrimary}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {busy ? "Saving…" : "Save the new password"}
        </button>
      </form>
    </div>
  );
}
