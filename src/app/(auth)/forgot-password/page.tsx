import type { Metadata } from "next";
import { emailConfigured } from "../../../server/email";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset your password · Delta" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm emailEnabled={emailConfigured()} />;
}
