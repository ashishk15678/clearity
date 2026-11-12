import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AcceptInviteButton } from "./accept-button";

export const metadata = { title: "Accept Invite · Clarity" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { organization: { select: { name: true, slug: true } } },
  });

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground mb-2">
            Invalid invite
          </p>
          <p className="text-muted-foreground text-sm">
            This link doesn't exist or has expired.
          </p>
        </div>
      </div>
    );
  }

  if (invite.acceptedAt) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground mb-2">
            Already accepted
          </p>
          <p className="text-muted-foreground text-sm">
            This invite has already been used.
          </p>
        </div>
      </div>
    );
  }

  if (invite.expiresAt < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground mb-2">
            Invite expired
          </p>
          <p className="text-muted-foreground text-sm">
            Ask the sender to send a new invite.
          </p>
        </div>
      </div>
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-card shadow-lg p-8 text-center space-y-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mx-auto">
          <svg
            className="h-7 w-7 text-primary"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">
            You've been invited to{" "}
            <span className="text-primary">{invite.organization.name}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Join as{" "}
            <span className="font-medium text-foreground">{invite.role}</span>
          </p>
        </div>

        {!session ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Sign in to accept this invite.
            </p>
            <a
              href={`/login?redirect=/invite/${token}`}
              className="block w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Sign in
            </a>
            <a
              href={`/signup?redirect=/invite/${token}`}
              className="block w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Create account
            </a>
          </div>
        ) : session.user.email !== invite.email ? (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            This invite is for <strong>{invite.email}</strong> but you're signed
            in as <strong>{session.user.email}</strong>.
          </div>
        ) : (
          <AcceptInviteButton
            token={token}
            orgSlug={invite.organization.slug}
          />
        )}
      </div>
    </div>
  );
}
