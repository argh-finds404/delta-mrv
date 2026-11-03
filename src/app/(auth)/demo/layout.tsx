import { notFound } from "next/navigation";
import { env } from "../../../env";

// The demo route does not exist unless DEMO_MODE=true (docs/04-AUTH.md §8).
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  if (!env.DEMO_MODE) notFound();
  return children;
}
