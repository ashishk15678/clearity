"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

// ─── Icons ────────────────────────────────────────────────────────────────────

function Icon({
  d,
  d2,
  evenOdd,
}: {
  d: string;
  d2?: string;
  evenOdd?: boolean;
}) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      {d2 ? (
        <>
          <path d={d} />
          <path
            fillRule={evenOdd ? "evenodd" : undefined}
            clipRule={evenOdd ? "evenodd" : undefined}
            d={d2}
          />
        </>
      ) : (
        <path
          fillRule={evenOdd ? "evenodd" : undefined}
          clipRule={evenOdd ? "evenodd" : undefined}
          d={d}
        />
      )}
    </svg>
  );
}

function ClarityLogo() {
  return (
    <svg viewBox="0 0 28 28" className="h-6 w-6 shrink-0" fill="none">
      <rect width="28" height="28" rx="8" fill="#1f42d0" />
      <path
        d="M7 14a7 7 0 0114 0"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="14" cy="14" r="2.5" fill="white" />
    </svg>
  );
}

// ─── Nav items (paths built dynamically with orgSlug) ─────────────────────────

function buildNav(orgSlug: string) {
  const base = `/console/${orgSlug}`;
  return {
    main: [
      {
        href: base,
        label: "Overview",
        icon: (
          <Icon d="M10.707 2.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 11h1v6a1 1 0 001 1h4v-4h2v4h4a1 1 0 001-1v-6h1a1 1 0 00.707-1.707l-7-7z" />
        ),
        exact: true,
      },
      {
        href: `${base}/projects`,
        label: "Projects",
        icon: (
          <Icon d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        ),
      },
      {
        href: `${base}/reports`,
        label: "Reports",
        icon: (
          <Icon d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        ),
      },
    ],
    team: [
      {
        href: `${base}/teams`,
        label: "Teams",
        icon: (
          <Icon
            evenOdd
            d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"
          />
        ),
      },
      {
        href: `${base}/billing`,
        label: "Billing",
        icon: (
          <Icon
            evenOdd
            d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"
            d2="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
          />
        ),
      },
      {
        href: `${base}/settings`,
        label: "Settings",
        icon: (
          <Icon
            evenOdd
            d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
          />
        ),
      },
    ],
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Sidebar({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();
  const base = `/console/${orgSlug}`;

  const isActive = (href: string, exact = false) =>
    exact
      ? pathname === href
      : pathname === href ||
        pathname.startsWith(href + "/") ||
        pathname.startsWith(href + "?");

  const nav = buildNav(orgSlug);

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-4 border-b border-border">
        <ClarityLogo />
        <span className="text-sm font-semibold tracking-tight">Clarity</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
        <NavSection>
          {nav.main.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActive(item.href, item.exact)}
            />
          ))}
        </NavSection>

        <NavSectionLabel label="Workspace" className="mt-4" />
        <NavSection>
          {nav.team.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActive(item.href)}
            />
          ))}
        </NavSection>
      </nav>

      {/* Bottom user pill */}
      <div className="border-t border-border p-2">
        <Link
          href={`${base}/settings`}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
            isActive(`${base}/settings`)
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          )}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
            C
          </span>
          <span className="truncate text-xs">Account</span>
        </Link>
      </div>
    </aside>
  );
}

function NavSection({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-0.5">{children}</div>;
}

function NavSectionLabel({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "px-2.5 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider",
        className,
      )}
    >
      {label}
    </p>
  );
}

function NavLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
      )}
    >
      <span
        className={cn(
          "transition-colors",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        {icon}
      </span>
      {label}
    </Link>
  );
}
