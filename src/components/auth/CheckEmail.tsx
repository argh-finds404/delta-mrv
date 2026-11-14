import { DrawnIcon } from "@/src/components/motion/DrawnIcon";

/** "A link is on its way": the same words whether or not an account exists for the address. */
export function CheckEmail({ email, purpose, children }: { email: string; purpose: "verify" | "reset"; children?: React.ReactNode }) {
  return (
    <div role="status" className="space-y-4 rounded-xl border border-field-hairline bg-field-canopy p-6" data-testid="check-email">
      <span aria-hidden className="inline-flex size-11 items-center justify-center rounded-full bg-verified/10 text-verified">
        <DrawnIcon mark="mail" circle={false} className="size-6" />
      </span>
      <h2 className="font-serif text-[28px] leading-[1.15] tracking-[-0.01em]">Check your email</h2>
      <p className="text-[15px] leading-[1.6] text-field-muted">
        {purpose === "verify" ? (
          <>
            We sent a link to <strong className="font-medium text-field-text">{email}</strong>. Open it to confirm the address is yours; it signs you in and finishes setting up your account.
          </>
        ) : (
          <>
            If an account exists for <strong className="font-medium text-field-text">{email}</strong>, a link to choose a new password is on its way. It works once, for one hour.
          </>
        )}
      </p>
      <p className="text-[14px] leading-[1.6] text-field-muted">Nothing after a few minutes? Check spam, or try again with the address you signed up with.</p>
      {children}
    </div>
  );
}
