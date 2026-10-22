import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ModeToggle } from "@/components/ui/theme-changer";
import { OrgSwitcher } from "../org-switcher";

export async function Topbar({ title }: { title: string }) {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-3">
        <ModeToggle />
        {session?.user && (
          <div className="flex items-center justify-center gap-x-2">
            <OrgSwitcher />
            <span className="text-xs text-muted-foreground hidden sm:block">
              {session.user.email}
            </span>
          </div>
        )}
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold"
          aria-label="User avatar"
        >
          {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
        </span>
      </div>
    </header>
  );
}
