"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { UserAvatar } from "@/components/user-avatar";

function ClarityLogo() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" fill="none">
      <rect width="20" height="20" rx="5" fill="#0070f3" />
      <path
        d="M5 10a5 5 0 0110 0"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="10" cy="10" r="1.75" fill="white" />
    </svg>
  );
}

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

// ─── Nav definitions ──────────────────────────────────────────────────────────

function buildNav(orgSlug: string) {
  const base = `/console/${orgSlug}`;
  return {
    main: [
      {
        href: base,
        label: "Overview",
        exact: true,
        icon: (
          <Icon d="M10.707 2.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 11h1v6a1 1 0 001 1h4v-4h2v4h4a1 1 0 001-1v-6h1a1 1 0 00.707-1.707l-7-7z" />
        ),
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
    workspace: [
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

// ─── Sidebar component ────────────────────────────────────────────────────────

export function Sidebar({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();
  const base = `/console/${orgSlug}`;
  const nav = buildNav(orgSlug);

  const isActive = (href: string, exact = false) =>
    exact
      ? pathname === href
      : pathname === href ||
        pathname.startsWith(href + "/") ||
        pathname.startsWith(href + "?");
  const params = useParams<{ slug?: string }>();

  const currentProject = params?.slug;
  const isInsideProject = Boolean(currentProject);
  return (
    <aside className="flex h-screen w-[210px] shrink-0 flex-col border-r border-border bg-sidebar">
      {/* ── Logo / brand ─────────────────────────────────────────────────── */}
      <div className="flex h-[52px] items-center gap-2.5 border-b border-border px-4">
        <ClarityLogo />
        <span className="text-[13px] font-semibold tracking-tight text-foreground">
          Clarity
        </span>
      </div>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-3 gap-0.5">
        {/* Main */}
        <div className="flex flex-col gap-0.5">
          {nav.main.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActive(item.href, item.exact)}
            />
          ))}
        </div>

        {/* Workspace section */}
        <div className="mt-4 flex flex-col gap-0.5">
          <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
            Workspace
          </p>
          {nav.workspace.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActive(item.href)}
            />
          ))}
        </div>
      </nav>

      {/* ── User pill ─────────────────────────────────────────────────────── */}
      <div className="border-t border-border p-2">
        <Link
          href={`${base}/settings`}
          className={cn(
            "flex items-center justify-between gap-2.5 rounded-md px-2.5 py-0.5wazzzzd text-sm transition-colors",
            isActive(`${base}/settings`)
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          )}
        >
          <span className="truncate text-xs font-medium">{orgSlug}</span>
          <UserAvatar name={orgSlug} size={40} />
        </Link>
      </div>
    </aside>
  );
}

// ─── NavItem ──────────────────────────────────────────────────────────────────

function NavItem({
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
        "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "transition-colors",
          active
            ? "text-foreground"
            : "text-muted-foreground group-hover:text-foreground",
        )}
      >
        {icon}
      </span>
      {label}
    </Link>
  );
}
