import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";

export const metadata = { title: "Dashboard · Clarity" };

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Welcome back, {session.user.name}
        </h1>
        <p className="mb-6 text-sm text-zinc-500">{session.user.email}</p>
        <SignOutButton />
      </div>
    </div>
  );
}
