import { SignupForm } from "./signup-form";

export const metadata = { title: "Sign up · Clarity" };

export default function SignupPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50 text-center">
          Create your account
        </h1>
        <SignupForm />
        <p className="mt-4 text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <a
            href="/login"
            className="font-medium text-zinc-900 underline dark:text-zinc-50"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
