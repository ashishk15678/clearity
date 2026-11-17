import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Sign up · Clarity" };

export default function SignupPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-background px-4">
      {/* Grid + radial matching login page */}
      <div className="pointer-events-none fixed inset-0 -z-10 h-full w-full bg-background [background-image:linear-gradient(to_right,hsl(var(--border)/0.5)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.5)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.08),transparent)]" />

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none">
              <path
                d="M4 10a6 6 0 0112 0"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="10" cy="10" r="2" fill="white" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Create your account
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Free forever. No credit card needed.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_1px_3px_rgb(0_0_0/0.06),0_0_0_1px_rgb(0_0_0/0.03)]">
          <SignupForm />
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground hover:underline underline-offset-2"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
