"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { CheckEmail } from "@/src/components/auth/CheckEmail";
import { OrganisationFields } from "@/src/components/auth/OrganisationFields";
import { createOrganisation, finishUrl, type OrgDetails } from "@/src/components/auth/create-organisation";
import { authClient } from "@/src/lib/auth-client";
import { safeNext } from "@/src/lib/safe-next";
import { cn } from "@/src/lib/utils";

export type OrgType = "OWNER" | "VERIFIER" | "FUNDER";

export interface SignUpData {
  name: string;
  email: string;
  password: string;
  organizationName: string;
  country: string;
  website: string;
  organizationType: OrgType;
}

export interface SignUpPageProps {
  /** Optional submit handler */
  onSubmit?: (data: SignUpData) => Promise<{ success: boolean; error?: string }>;
}

/**
 * The real registration: create the user, then their organisation with its org_type. Where the
 * server confirms email addresses there is no session until the emailed link is opened, so the
 * organisation is created on /sign-up/finish, where that link returns. Better Auth reports
 * failures as { error }, not as exceptions.
 */
async function registerWithAuth(data: SignUpData): Promise<{ success: boolean; error?: string; verifyEmail?: string }> {
  const details: OrgDetails = { name: data.organizationName.trim(), type: data.organizationType, country: data.country.trim(), website: data.website.trim() };
  const account = await authClient.signUp.email({
    name: data.name.trim(),
    email: data.email.trim(),
    password: data.password,
    callbackURL: finishUrl(details),
  });
  if (account.error) return { success: false, error: account.error.message ?? "Could not create the account." };
  if (!account.data?.token) return { success: true, verifyEmail: data.email.trim() };

  const org = await createOrganisation(details);
  if (!org.ok) return { success: false, error: `Your account was created, but the organisation was not: ${org.error}. Sign in to try again.` };
  return { success: true };
}

/**
 * Calculates a 0-4 password strength score and provides helpful guidance
 * per docs/15-UI-STATES.md §6 (specific guidance, never a scolding list of rules).
 */
function evaluatePasswordStrength(password: string): {
  score: number; // 0 to 4
  guidance: string;
} {
  if (!password) {
    return { score: 0, guidance: "Enter a password" };
  }

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password) || /[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) {
    return { score: 1, guidance: "Add a few more characters" };
  }
  if (score === 2) {
    return { score: 2, guidance: "Mix in uppercase, lowercase and numbers" };
  }
  if (score === 3) {
    return { score: 3, guidance: password.length < 12 ? "Good strength — 12 characters or more makes it strong" : "Good strength — mix upper and lower case with a number or symbol" };
  }
  return { score: 4, guidance: "Strong password" };
}

/**
 * SignUpPage — Two-step onboarding flow.
 * Authority: docs/15-UI-STATES.md §6.
 * Step 1: Personal credentials with constructive 4-segment strength bar.
 * Step 2: Organisation details and 3-card type selector (never a dropdown).
 */
export default function SignUpPage({ onSubmit }: SignUpPageProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2>(1);
  // Read from the address bar, so the page needs no Suspense boundary; "" on the server.
  const search = React.useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => "",
  );
  const next = safeNext(new URLSearchParams(search).get("next"));
  // Someone following an invitation link joins an existing organisation: they do not register one.
  const joining = next?.startsWith("/dashboard?invite=") ?? false;

  // Step 1: User state
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [capsLockActive, setCapsLockActive] = React.useState(false);

  // Step 2: Org state
  const [orgName, setOrgName] = React.useState("");
  const [country, setCountry] = React.useState("Bangladesh");
  const [website, setWebsite] = React.useState("");
  const [orgType, setOrgType] = React.useState<OrgType>("OWNER");

  // Errors & submission
  const [verifyEmail, setVerifyEmail] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [globalError, setGlobalError] = React.useState<string | null>(null);

  const passwordStrength = evaluatePasswordStrength(password);
  const changeOrg = (p: Partial<OrgDetails>) => {
    if (p.name !== undefined) {
      setOrgName(p.name);
      if (errors.orgName) setErrors((prev) => ({ ...prev, orgName: "" }));
    }
    if (p.country !== undefined) setCountry(p.country);
    if (p.website !== undefined) setWebsite(p.website);
    if (p.type !== undefined) setOrgType(p.type);
  };

  // Validate Step 1 before advancing
  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = "Full name is required";
    if (!email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    if (!joining) return setStep(2);

    // invited: the account only; the invitation itself is accepted on the overview
    setIsSubmitting(true);
    setGlobalError(null);
    authClient.signUp
      .email({ name: name.trim(), email: email.trim(), password, callbackURL: next ?? "/dashboard" })
      .then((account) => {
        if (account.error) setGlobalError(account.error.message ?? "Could not create the account.");
        // the emailed link signs them in and returns to the invitation
        else if (!account.data?.token) setVerifyEmail(email.trim());
        else router.push(next ?? "/dashboard");
      })
      .catch(() => setGlobalError("Could not connect to the authentication service. Please try again."))
      .finally(() => setIsSubmitting(false));
  };

  // Final submit
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!orgName.trim()) newErrors.orgName = "Organisation name is required";
    if (!country.trim()) newErrors.country = "Country is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    setGlobalError(null);

    const payload: SignUpData = {
      name,
      email,
      password,
      organizationName: orgName,
      country,
      website,
      organizationType: orgType,
    };

    try {
      if (onSubmit) {
        const res = await onSubmit(payload);
        if (!res.success) {
          setGlobalError(res.error ?? "Registration failed. Please try again.");
        }
      } else {
        const res = await registerWithAuth(payload);
        if (!res.success) {
          setGlobalError(res.error ?? "Registration failed. Please try again.");
        } else if (res.verifyEmail) {
          setVerifyEmail(res.verifyEmail);
        } else {
          // the role-aware home (docs/05-ROUTES.md §3), unless the proxy sent them from somewhere
          router.push(safeNext(new URLSearchParams(window.location.search).get("next")) ?? "/dashboard");
        }
      }
    } catch {
      setGlobalError("Could not connect to the authentication service. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (verifyEmail) {
    return (
      <div className="space-y-6 text-field-text">
        <CheckEmail email={verifyEmail} purpose="verify" />
        <p className="text-[15px] text-field-muted">
          Already confirmed?{" "}
          <Link href="/sign-in" className="text-field-text underline decoration-field-hairline underline-offset-[5px] hover:decoration-field-text">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-field-text">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-field-muted">
            {joining ? "You were invited" : `Step ${step} of 2 · ${step === 1 ? "Your account" : "Organisation"}`}
          </span>
          {!joining && (
          <div className="flex gap-1.5">
            <span
              className={cn(
                "h-1 w-6 rounded-full",
                step >= 1 ? "bg-field-text" : "bg-field-hairline"
              )}
            />
            <span
              className={cn(
                "h-1 w-6 rounded-full",
                step === 2 ? "bg-field-text" : "bg-field-hairline"
              )}
            />
          </div>
          )}
        </div>

        <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em] text-field-text">
          {step === 1 ? "Create your Delta account" : "Register your organisation"}
        </h1>
        <p className="text-[15px] leading-[1.55] text-field-muted">
          {joining
            ? "Use the email address the invitation was made for. You join the organisation on the next screen."
            : step === 1
            ? "Your identity as a field researcher, verifier or project director."
            : "Every project and review is bound to an authenticated tenant organisation."}
        </p>
      </div>

      {globalError && (
        <div
          role="alert"
          className="rounded-lg border border-fraud/40 bg-fraud/10 px-4 py-3 text-[15px] text-field-text"
        >
          {globalError}
        </div>
      )}

      {/* STEP 1: USER DETAILS */}
      {step === 1 && (
        <form method="post" onSubmit={handleProceedToStep2} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="name"
              className="block text-[14px] font-medium text-field-text"
            >
              Full name
            </label>
            <input
              id="name"
              type="text"
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
              }}
              autoComplete="name"
              required
              className={cn(
                "h-12 w-full rounded-lg border px-3.5 text-[16px] text-field-text bg-field-canopy focus-visible:outline-none focus-visible:ring-2 transition-colors",
                errors.name
                  ? "border-fraud focus-visible:ring-fraud"
                  : "border-field-hairline focus-visible:ring-signal"
              )}
              placeholder="Dr. Tahmina Akhtar"
            />
            {errors.name && (
              <p className="text-[13px] text-fraud">{errors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-[14px] font-medium text-field-text"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              name="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
              }}
              autoComplete="email"
              required
              className={cn(
                "h-12 w-full rounded-lg border px-3.5 text-[16px] text-field-text bg-field-canopy focus-visible:outline-none focus-visible:ring-2 transition-colors",
                errors.email
                  ? "border-fraud focus-visible:ring-fraud"
                  : "border-field-hairline focus-visible:ring-signal"
              )}
              placeholder="tahmina@sundarbans-trust.org"
            />
            {errors.email && (
              <p className="text-[13px] text-fraud">{errors.email}</p>
            )}
          </div>

          {/* Password with 4-segment strength bar */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-[14px] font-medium text-field-text"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: "" }));
                }}
                onKeyDown={(e) => {
                  if (e.getModifierState) setCapsLockActive(e.getModifierState("CapsLock"));
                }}
                onKeyUp={(e) => {
                  if (e.getModifierState) setCapsLockActive(e.getModifierState("CapsLock"));
                }}
                autoComplete="new-password"
                required
                className={cn(
                  "h-12 w-full rounded-lg border px-3.5 pr-12 text-[16px] text-field-text bg-field-canopy focus-visible:outline-none focus-visible:ring-2 transition-colors",
                  errors.password
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
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            {capsLockActive && (
              <p className="text-[13px] text-review">Caps Lock is on</p>
            )}

            {/* 4-Segment Strength Bar (docs/15-UI-STATES.md §6) */}
            {password.length > 0 && (
              <div className="pt-1.5 space-y-1">
                <div className="grid grid-cols-4 gap-1.5">
                  {Array.from({ length: 4 }).map((_, index) => {
                    const isFilled = index < passwordStrength.score;
                    return (
                      <div
                        key={index}
                        className={cn(
                          "h-1 rounded-full transition-colors",
                          !isFilled
                            ? "bg-field-hairline"
                            : passwordStrength.score === 1
                            ? "bg-fraud"
                            : passwordStrength.score <= 3
                            ? "bg-review"
                            : "bg-verified"
                        )}
                      />
                    );
                  })}
                </div>
                <p className="text-[13px] text-field-muted">
                  {passwordStrength.guidance}
                </p>
              </div>
            )}

            {errors.password && (
              <p className="text-[13px] text-fraud">{errors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full flex items-center justify-center gap-2 rounded-lg bg-signal px-5 text-[16px] font-medium text-field-abyss hover:bg-[#14543D] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal cursor-pointer disabled:opacity-60"
          >
            <span>{joining ? (isSubmitting ? "Creating your account…" : "Create account") : "Continue to organisation details"}</span>
            <ArrowRight className="size-3.5" />
          </button>
        </form>
      )}

      {/* STEP 2: ORGANISATION & TYPE CARDS */}
      {step === 2 && (
        <form method="post" onSubmit={handleFinalSubmit} noValidate className="space-y-5">
          <OrganisationFields value={{ name: orgName, country, website, type: orgType }} onChange={changeOrg} error={errors.orgName} />

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex h-12 items-center gap-1.5 rounded-lg border border-field-hairline px-4 text-[15px] font-medium text-field-muted hover:text-field-text transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex h-12 items-center justify-center gap-2 rounded-lg bg-signal px-5 text-[16px] font-medium text-field-abyss hover:bg-[#14543D] disabled:opacity-60 transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Registering organisation…</span>
                </>
              ) : (
                <>
                  <span>Register organisation</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      <div className="pt-6 border-t border-field-hairline text-[15px]">
        <span className="text-field-muted">Already registered? </span>
        <Link
          href={joining && next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in"}
          className="text-field-text underline underline-offset-2 hover:text-field-muted transition-colors"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

