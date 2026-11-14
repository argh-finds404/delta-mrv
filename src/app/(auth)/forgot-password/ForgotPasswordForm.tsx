"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { CheckEmail } from "@/src/components/auth/CheckEmail";
import { authField, authLabel, authPrimary } from "@/src/components/auth/form-styles";
import { authClient } from "@/src/lib/auth-client";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const back = "inline-flex items-center gap-1.5 text-[15px] text-field-muted underline decoration-field-hairline underline-offset-[5px] transition-colors hover:text-field-text";

/** Asks for a reset link. The answer never says whether the address has an account. */
export function ForgotPasswordForm({ emailEnabled }: { emailEnabled: boolean }) {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  if (!emailEnabled) {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em]">Reset your password</h1>
        <p className="text-[16px] leading-[1.6] text-field-muted">
          This copy of Delta does not send email, so it cannot send a reset link. Ask an admin of your organisation to invite you again, or a Delta operator for help.
        </p>
        <Link href="/sign-in" className={back}>
          <ArrowLeft className="size-4" aria-hidden /> Back to sign in
        </Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) return setError("Enter the email address you signed up with.");
    setBusy(true);
    setError(null);
    try {
      const res = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" });
      if (res.error?.status === 429) setError("Too many requests. Wait a minute and try again.");
      else setSentTo(email.trim()); // the same answer whether or not the account exists
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em]">Reset your password</h1>
        <p className="text-[16px] leading-[1.55] text-field-muted">We will email you a link to choose a new one. Your projects and reviews are untouched.</p>
      </header>
      {sentTo ? (
        <CheckEmail email={sentTo} purpose="reset" />
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className={authLabel}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "email-error" : undefined}
              className={authField(Boolean(error))}
            />
            {error && (
              <p id="email-error" role="alert" className="text-[14px] text-fraud">
                {error}
              </p>
            )}
          </div>
          <button type="submit" disabled={busy} className={authPrimary}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {busy ? "Sending…" : "Send the link"}
          </button>
        </form>
      )}
      <Link href="/sign-in" className={back}>
        <ArrowLeft className="size-4" aria-hidden /> Back to sign in
      </Link>
    </div>
  );
}
