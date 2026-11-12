import * as React from "react";
import { AuthArt } from "@/src/components/auth/AuthArt";

// Sign in, sign up, demo: the painting on the left (a short band on a phone), the form on the right.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-field-abyss text-field-text md:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
      <AuthArt />
      <main className="flex items-start justify-center px-6 pb-16 pt-4 md:items-center md:px-12 md:py-16">
        <div className="w-full max-w-[440px]">{children}</div>
      </main>
    </div>
  );
}
