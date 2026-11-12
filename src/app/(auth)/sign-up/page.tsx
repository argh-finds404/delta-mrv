"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
  Building2,
  ShieldCheck,
  Coins,
} from "lucide-react";
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
 * The real registration: create the user (which signs them in), then their organisation
 * with its org_type. Better Auth reports failures as { error }, not as exceptions.
 */
async function registerWithAuth(data: SignUpData): Promise<{ success: boolean; error?: string }> {
  const account = await authClient.signUp.email({
    name: data.name.trim(),
    email: data.email.trim(),
    password: data.password,
  });
  if (account.error) return { success: false, error: account.error.message ?? "Could not create the account." };

  const base = data.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "organisation";
  const org = await authClient.organization.create({
    name: data.organizationName.trim(),
    slug: `${base}-${crypto.randomUUID().slice(0, 6)}`, // slugs are unique; two orgs may share a name
    orgType: data.organizationType,
    country: data.country.trim(),
    website: data.website.trim() || undefined,
  });
  if (org.error) {
    return {
      success: false,
      error: `Your account was created, but the organisation was not: ${org.error.message ?? "unknown error"}. Sign in to try again.`,
    };
  }
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
    return { score: 3, guidance: "Good strength — consider adding a symbol" };
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
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [globalError, setGlobalError] = React.useState<string | null>(null);

  const passwordStrength = evaluatePasswordStrength(password);

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
    setStep(2);
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

  return (
    <div className="space-y-6 text-field-text">
      {/* Header & Step Tracker */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-field-muted">
            Step {step} of 2 · {step === 1 ? "Your account" : "Organisation"}
          </span>
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
        </div>

        <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em] text-field-text">
          {step === 1 ? "Create your Delta account" : "Register your organisation"}
        </h1>
        <p className="text-[15px] leading-[1.55] text-field-muted">
          {step === 1
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
          {/* Full Name */}
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

          {/* Email */}
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
            className="h-12 w-full flex items-center justify-center gap-2 rounded-lg bg-signal px-5 text-[16px] font-medium text-field-abyss hover:bg-[#C6EE9E] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal cursor-pointer"
          >
            <span>Continue to organisation details</span>
            <ArrowRight className="size-3.5" />
          </button>
        </form>
      )}

      {/* STEP 2: ORGANISATION & TYPE CARDS */}
      {step === 2 && (
        <form method="post" onSubmit={handleFinalSubmit} noValidate className="space-y-5">
          {/* Organisation Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="orgName"
              className="block text-[14px] font-medium text-field-text"
            >
              Organisation legal name
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={(e) => {
                setOrgName(e.target.value);
                if (errors.orgName) setErrors((prev) => ({ ...prev, orgName: "" }));
              }}
              required
              className={cn(
                "h-12 w-full rounded-lg border px-3.5 text-[16px] text-field-text bg-field-canopy focus-visible:outline-none focus-visible:ring-2 transition-colors",
                errors.orgName
                  ? "border-fraud focus-visible:ring-fraud"
                  : "border-field-hairline focus-visible:ring-signal"
              )}
              placeholder="e.g. Sundarbans Restoration Trust"
            />
            {errors.orgName && (
              <p className="text-[13px] text-fraud">{errors.orgName}</p>
            )}
          </div>

          {/* Country & Website Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="country"
                className="block text-[14px] font-medium text-field-text"
              >
                Country of registry
              </label>
              <input
                id="country"
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
                className="h-12 w-full rounded-lg border border-field-hairline px-3.5 text-[16px] text-field-text bg-field-canopy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="website"
                className="block text-[14px] font-medium text-field-text"
              >
                Website (optional)
              </label>
              <input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.org"
                className="h-12 w-full rounded-lg border border-field-hairline px-3.5 text-[16px] text-field-text bg-field-canopy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              />
            </div>
          </div>

          {/* ORGANISATION TYPE SELECTOR (Three Cards, Never a Dropdown - docs/15-UI-STATES.md §6) */}
          <div className="space-y-2">
            <label className="block text-[14px] font-medium text-field-text">
              Organisation type
            </label>

            <div className="space-y-2.5">
              {/* Card 1: Project Owner */}
              <button
                type="button"
                onClick={() => setOrgType("OWNER")}
                className={cn(
                  "w-full text-left rounded-lg border p-3 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-field-text cursor-pointer",
                  orgType === "OWNER"
                    ? "border-field-text bg-field-raised/80"
                    : "border-field-hairline bg-field-canopy hover:bg-field-raised/40"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className={cn("size-4", orgType === "OWNER" ? "text-field-text" : "text-field-muted")} />
                    <span className="text-[15px] font-medium text-field-text">Project owner</span>
                  </div>
                  {orgType === "OWNER" && (
                    <span className="flex size-4 items-center justify-center rounded-full bg-field-text text-field-abyss">
                      <Check className="size-3 stroke-[3]" />
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[14px] leading-[1.5] text-field-muted pl-6">
                  You run restoration projects and submit evidence
                </p>
              </button>

              {/* Card 2: Independent Verifier */}
              <button
                type="button"
                onClick={() => setOrgType("VERIFIER")}
                className={cn(
                  "w-full text-left rounded-lg border p-3 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-field-text cursor-pointer",
                  orgType === "VERIFIER"
                    ? "border-field-text bg-field-raised/80"
                    : "border-field-hairline bg-field-canopy hover:bg-field-raised/40"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={cn("size-4", orgType === "VERIFIER" ? "text-field-text" : "text-field-muted")} />
                    <span className="text-[15px] font-medium text-field-text">Independent verifier</span>
                  </div>
                  {orgType === "VERIFIER" && (
                    <span className="flex size-4 items-center justify-center rounded-full bg-field-text text-field-abyss">
                      <Check className="size-3 stroke-[3]" />
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[14px] leading-[1.5] text-field-muted pl-6">
                  You review other organisations&apos; evidence
                </p>
              </button>

              {/* Card 3: Funder */}
              <button
                type="button"
                onClick={() => setOrgType("FUNDER")}
                className={cn(
                  "w-full text-left rounded-lg border p-3 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-field-text cursor-pointer",
                  orgType === "FUNDER"
                    ? "border-field-text bg-field-raised/80"
                    : "border-field-hairline bg-field-canopy hover:bg-field-raised/40"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Coins className={cn("size-4", orgType === "FUNDER" ? "text-field-text" : "text-field-muted")} />
                    <span className="text-[15px] font-medium text-field-text">Funder</span>
                  </div>
                  {orgType === "FUNDER" && (
                    <span className="flex size-4 items-center justify-center rounded-full bg-field-text text-field-abyss">
                      <Check className="size-3 stroke-[3]" />
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[14px] leading-[1.5] text-field-muted pl-6">
                  You fund projects and review verified outcomes
                </p>
              </button>
            </div>

            {/* Crucial conflict-of-interest notice (docs/15-UI-STATES.md §6) */}
            <p className="mt-2 text-[14px] leading-[1.5] text-field-muted">
              Organisation type determines what you can do. A project owner cannot
              review evidence, including its own. This cannot be changed later
              without administrator approval.
            </p>
          </div>

          {/* Action Buttons */}
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
              className="flex-1 flex h-12 items-center justify-center gap-2 rounded-lg bg-signal px-5 text-[16px] font-medium text-field-abyss hover:bg-[#C6EE9E] disabled:opacity-60 transition-colors cursor-pointer"
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

      {/* Auxiliary Link */}
      <div className="pt-6 border-t border-field-hairline text-[15px]">
        <span className="text-field-muted">Already registered? </span>
        <Link
          href="/sign-in"
          className="text-field-text underline underline-offset-2 hover:text-field-muted transition-colors"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

