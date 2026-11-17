import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ModeToggle } from "@/components/ui/theme-changer";
import { OrgSwitcher } from "../org-switcher";
import { UserAvatar } from "../user-avatar";
import { NotificationBell } from "../notification-bell";

export async function Topbar({ title, id = "" }: { title: string; id?: string }) {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-background px-5">
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-[13px] font-semibold text-foreground truncate">{title}</h1>
        {id && (
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
            {id}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <ModeToggle />

        {session?.user && (
          <>
            {/* Notifications bell — client component for real-time badge */}
            <NotificationBell />

            <div className="mx-1 h-4 w-px bg-border" aria-hidden />

            <OrgSwitcher />

            <span className="hidden md:block text-[12px] text-muted-foreground px-1">
              {session.user.email}
            </span>

            <UserAvatar name={session.user.name ?? session.user.email ?? ""} size={26} />
          </>
        )}
      </div>
    </header>
  );
}
