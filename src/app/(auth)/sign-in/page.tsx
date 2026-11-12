import { env } from "../../../env";
import { SignInForm } from "./SignInForm";

// A server page so the server-only DEMO_MODE flag can decide whether the demo link shows.
export default function SignInPage() {
  return <SignInForm demoEnabled={Boolean(env.DEMO_MODE)} />;
}
