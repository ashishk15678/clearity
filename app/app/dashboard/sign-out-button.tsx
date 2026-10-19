"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function SignOutButton() {
  const router = useRouter();
  const trpc = useTRPC();

  const signOut = useMutation(
    trpc.auth.signOut.mutationOptions({
      onSuccess: () => {
        router.push("/login");
        router.refresh();
      },
    })
  );

  return (
    <button
      onClick={() => signOut.mutate()}
      disabled={signOut.isPending}
      className="flex h-10 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
    >
      {signOut.isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
