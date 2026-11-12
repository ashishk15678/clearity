"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";

export function AcceptInviteButton({
  token,
  orgSlug,
}: {
  token: string;
  orgSlug: string;
}) {
  const router = useRouter();
  const trpc = useTRPC();

  const accept = useMutation(
    trpc.org.acceptInvite.mutationOptions({
      onSuccess: () => {
        router.push(`/console/${orgSlug}`);
      },
    }),
  );

  return (
    <div className="space-y-3">
      {accept.error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {accept.error.message}
        </p>
      )}
      <Button
        variant="primary"
        className="w-full"
        disabled={accept.isPending}
        onClick={() => accept.mutate({ token })}
      >
        {accept.isPending ? "Accepting…" : "Accept invite"}
      </Button>
    </div>
  );
}
