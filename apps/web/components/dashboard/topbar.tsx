import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ModeToggle } from "@/components/ui/theme-changer";
import { OrgSwitcher } from "../org-switcher";
import { UserAvatar } from "../user-avatar";
import { NotificationBell } from "../notification-bell";

export async function Topbar({
  title,
  id = "",
}: {
  title: string;
  id?: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-background px-6 sticky top-0 z-30">
      {/* Left: breadcrumb-style title */}
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-[13px] font-medium text-foreground/60 truncate select-none">
          {title}
        </h1>
        {id && (
          <>
            <span className="text-foreground/20 select-none">/</span>
            <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-mono text-primary border border-primary/20">
              {id}
            </span>
          </>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <ModeToggle />

        {session?.user && (
          <>
            <NotificationBell />

            <div className="mx-1 h-4 w-px bg-border" aria-hidden />

            <OrgSwitcher />

            <span className="hidden md:block text-[11px] text-muted-foreground px-1 max-w-[160px] truncate">
              {session.user.email}
            </span>

            <UserAvatar
              name={session.user.name ?? session.user.email ?? ""}
              size={24}
            />
          </>
        )}
      </div>
    </header>
  );
}
