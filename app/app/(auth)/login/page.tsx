import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Clarity" };

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50 text-center">
          Sign in to Clarity
        </h1>
        <LoginForm />
        <p className="mt-4 text-center text-sm text-zinc-500">
          Don&apos;t have an account?{" "}
          <a
            href="/signup"
            className="font-medium text-zinc-900 underline dark:text-zinc-50"
          >
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
