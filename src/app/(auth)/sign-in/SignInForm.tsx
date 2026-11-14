"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { authField, authLabel, authPrimary } from "@/src/components/auth/form-styles";
import { authClient } from "@/src/lib/auth-client";
import { safeNext } from "@/src/lib/safe-next";
import { cn } from "@/src/lib/utils";

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignInPageProps {
  /** Optional mockable submit handler for tests. */
  onSubmit?: (credentials: SignInCredentials) => Promise<{ success: boolean; error?: string }>;
  /** Whether the /demo route exists (DEMO_MODE). The link is hidden when it does not. */
  demoEnabled?: boolean;
  /** Whether this server sends email: password reset is offered only when it does. */
  emailEnabled?: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A failed attempt never says which half was wrong or whether the account exists
 * (docs/15-UI-STATES.md §6); only a rate limit or an outage is told apart, because the
 * person can do something different about those.
 */
async function signInWithAuth({ email, password }: SignInCredentials): Promise<{ success: boolean; error?: string }> {
  const result = await authClient.signIn.email({ email: email.trim(), password });
  if (!result.error) return { success: true };
  if (result.error.status === 429) return { success: false, error: "Too many attempts. Wait a moment and try again." };
  if (result.error.status >= 500) return { success: false, error: "Sign-in is unavailable right now. Try again shortly." };
  // only reached with the right password, so it tells nothing to someone guessing addresses. The new
  // link returns through /sign-up/finish, which registers the organisation if it does not exist yet.
  if (result.error.code === "EMAIL_NOT_VERIFIED") {
    await authClient.sendVerificationEmail({ email: email.trim(), callbackURL: "/sign-up/finish" }).catch(() => null);
    return { success: false, error: "Confirm your email first. We have sent a new link to it; open it to sign in." };
  }
  return { success: false, error: "Email or password is incorrect." };
}

export function SignInForm({ onSubmit, demoEnabled = false, emailEnabled = false }: SignInPageProps) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [capsLock, setCapsLock] = React.useState(false);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const eErr = !email ? "Enter your email address." : EMAIL.test(email) ? null : "That does not look like an email address.";
    const pErr = password ? null : "Enter your password.";
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const res = onSubmit ? await onSubmit({ email, password }) : await signInWithAuth({ email, password });
      if (!res.success) setFormError(res.error ?? "Email or password is incorrect.");
      // next= is where the proxy caught them; read from the address bar so this page needs no
      // Suspense boundary. Otherwise the role-aware home (docs/05-ROUTES.md §3).
      else if (!onSubmit) router.push(safeNext(new URLSearchParams(window.location.search).get("next")) ?? "/dashboard");
    } catch {
      setFormError("Email or password is incorrect.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em]">Sign in</h1>
        <p className="text-[16px] leading-[1.55] text-field-muted">Your organisation&apos;s projects, submissions and review queue.</p>
      </header>

      {formError && (
        <p role="alert" className="rounded-lg border border-fraud/40 bg-fraud/10 px-4 py-3 text-[15px] text-field-text">
          {formError}
        </p>
      )}

      {/* A submit before hydration must POST: a GET would put the password in the address bar, history and logs. */}
      <form method="post" onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className={authLabel}>
            Email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(null);
              setFormError(null);
            }}
            onBlur={() => email && setEmailError(EMAIL.test(email) ? null : "That does not look like an email address.")}
            autoComplete="email"
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? "email-error" : undefined}
            required
            className={authField(Boolean(emailError))}
          />
          {emailError && (
            <p id="email-error" className="text-[14px] text-fraud">
              {emailError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="password" className={authLabel}>
              Password
            </label>
            {emailEnabled && (
              <Link href="/forgot-password" className="text-[14px] text-field-muted underline decoration-field-hairline underline-offset-[5px] transition-colors hover:text-field-text hover:decoration-field-text">
                Forgot your password?
              </Link>
            )}
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              name="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError(null);
                setFormError(null);
              }}
              onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
              onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
              autoComplete="current-password"
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? "password-error" : undefined}
              required
              className={cn(authField(Boolean(passwordError)), "pr-12")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-1.5 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-field-muted transition-colors hover:text-field-text focus-visible:outline-2 focus-visible:outline-signal"
            >
              {showPassword ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
            </button>
          </div>
          {passwordError && (
            <p id="password-error" className="text-[14px] text-fraud">
              {passwordError}
            </p>
          )}
          {capsLock && <p className="text-[14px] text-review">Caps Lock is on.</p>}
        </div>

        <button type="submit" disabled={submitting} className={authPrimary}>
          {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {submitting ? "Signing in…" : "Sign in"}
          {!submitting && <ArrowRight className="size-4" aria-hidden />}
        </button>
      </form>

      <div className="space-y-3 border-t border-field-hairline pt-6 text-[15px]">
        <p className="text-field-muted">
          New organisation?{" "}
          <Link
            href="/sign-up"
            // someone who arrived with an invitation link keeps it through sign-up
            onClick={(e) => {
              const next = safeNext(new URLSearchParams(window.location.search).get("next"));
              if (!next?.startsWith("/dashboard?invite=")) return;
              e.preventDefault();
              router.push(`/sign-up?next=${encodeURIComponent(next)}`);
            }}
            className="text-field-text underline decoration-field-hairline underline-offset-[5px] transition-colors hover:decoration-field-text"
          >
            Create an account
          </Link>
        </p>
        {/* /demo exists only with DEMO_MODE; never link to a page that would 404 */}
        {demoEnabled && (
          <p className="text-field-muted">
            Just looking?{" "}
            <Link href="/demo" className="text-field-text underline decoration-field-hairline underline-offset-[5px] transition-colors hover:decoration-field-text">
              Try it with a demo role
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
