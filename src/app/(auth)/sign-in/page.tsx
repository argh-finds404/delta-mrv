import { env } from "../../../env";
import { emailConfigured } from "../../../server/email";
import { SignInForm } from "./SignInForm";

// A server page so server-only settings decide what shows: the demo link (DEMO_MODE) and password reset (email).
export default function SignInPage() {
  return <SignInForm demoEnabled={Boolean(env.DEMO_MODE)} emailEnabled={emailConfigured()} />;
}
