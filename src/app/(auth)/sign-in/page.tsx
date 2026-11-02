"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/src/lib/utils";

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignInPageProps {
  /** Optional mockable submit handler for Lane A integration / testing */
  onSubmit?: (credentials: SignInCredentials) => Promise<{ success: boolean; error?: string }>;
}

/**
 * SignInPage — High-integrity authentication form.
 * Authority: docs/15-UI-STATES.md §6.
 * Enforces no placeholder-as-label, validate on blur, uniform failure message,
 * and zero keystroke shaming.
 */
export default function SignInPage({ onSubmit }: SignInPageProps) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [capsLockActive, setCapsLockActive] = React.useState(false);

  // Validation state
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Validate email format on blur (docs/15-UI-STATES.md §6)
  const handleEmailBlur = React.useCallback(() => {
    if (!email) return;
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValid) {
      setEmailError("Please enter a valid email address");
    } else {
      setEmailError(null);
    }
  }, [email]);

  const handlePasswordBlur = React.useCallback(() => {
    if (!password) return;
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
    } else {
      setPasswordError(null);
    }
  }, [password]);

  // Clear errors when the user edits the field (docs/15-UI-STATES.md §6)
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError) setEmailError(null);
    if (globalError) setGlobalError(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (passwordError) setPasswordError(null);
    if (globalError) setGlobalError(null);
  };

  // Caps lock detection on key events
  const handlePasswordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState("CapsLock"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let hasFormatError = false;
    if (!email) {
      setEmailError("Email address is required");
      hasFormatError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address");
      hasFormatError = true;
    }

    if (!password) {
      setPasswordError("Password is required");
      hasFormatError = true;
    }

    if (hasFormatError) return;

    setIsSubmitting(true);
    setGlobalError(null);

    try {
      if (onSubmit) {
        const res = await onSubmit({ email, password });
        if (!res.success) {
          setGlobalError(res.error ?? "Email or password is incorrect");
        }
      } else {
        // Presentation fixture mock delay
        await new Promise((resolve) => setTimeout(resolve, 600));
        // Deterministic fixture behavior: if email is demo@delta-mrv.test it simulates failure
        if (email.includes("fail") || password === "wrong") {
          setGlobalError("Email or password is incorrect");
        } else {
          setGlobalError("Email or password is incorrect"); // Simulated presentation state
        }
      }
    } catch {
      // Failed sign-in says only "Email or password is incorrect" — never which one (docs/15-UI-STATES.md §6)
      setGlobalError("Email or password is incorrect");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-field-text">
      {/* Form Title & Context */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-field-text">
          Sign in to Delta
        </h1>
        <p className="text-xs text-field-muted">
          Access your verified project workspace and review queue.
        </p>
      </div>

      {/* Global Submission Error (Always neutral without leaking account existence) */}
      {globalError && (
        <div
          role="alert"
          className="rounded border border-fraud/40 bg-[#E2644F]/10 px-3 py-2 text-xs text-field-text"
        >
          {globalError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-xs font-medium text-field-muted"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            name="email"
            value={email}
            onChange={handleEmailChange}
            onBlur={handleEmailBlur}
            autoComplete="email"
            required
            className={cn(
              "w-full rounded border px-3 py-2 text-xs text-field-text bg-field-raised/60 focus-visible:outline-none focus-visible:ring-1 transition-colors",
              emailError
                ? "border-fraud focus-visible:ring-fraud"
                : "border-field-hairline focus-visible:ring-signal"
            )}
            placeholder="verifier@organization.org"
          />
          {emailError && (
            <p className="text-[11px] text-fraud">{emailError}</p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-field-muted"
            >
              Password
            </label>
          </div>

          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              name="password"
              value={password}
              onChange={handlePasswordChange}
              onBlur={handlePasswordBlur}
              onKeyDown={handlePasswordKeyDown}
              onKeyUp={handlePasswordKeyDown}
              autoComplete="current-password"
              required
              className={cn(
                "w-full rounded border px-3 py-2 pr-9 text-xs text-field-text bg-field-raised/60 focus-visible:outline-none focus-visible:ring-1 transition-colors",
                passwordError
                  ? "border-fraud focus-visible:ring-fraud"
                  : "border-field-hairline focus-visible:ring-signal"
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-field-muted hover:text-field-text transition-colors"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>

          {passwordError && (
            <p className="text-[11px] text-fraud">{passwordError}</p>
          )}

          {capsLockActive && (
            <p className="text-[11px] text-review">Caps Lock is on</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 rounded bg-signal px-4 py-2 text-xs font-semibold text-[#0C1413] hover:bg-signal/90 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Signing in…</span>
            </>
          ) : (
            <>
              <span>Sign in</span>
              <ArrowRight className="size-3.5" />
            </>
          )}
        </button>
      </form>

      {/* Auxiliary Navigation Links */}
      <div className="pt-2 border-t border-field-hairline text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-field-muted">New organisation?</span>
          <Link
            href="/sign-up"
            className="text-signal hover:underline transition-colors"
          >
            Register
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-field-muted">Just exploring?</span>
          <Link
            href="/demo"
            className="text-field-text hover:underline transition-colors"
          >
            Try the demo
          </Link>
        </div>
      </div>
    </div>
  );
}

