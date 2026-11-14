import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password · Delta" };

// Reached from the emailed link: Better Auth checks the token, then sends the browser here with it.
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
