"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/cn";
import Link from "next/link";

// ── Icons ──────────────────────────────────────────────────────────────────────

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M10 2a6 6 0 00-6 6v2.586l-.707.707A1 1 0 004 13h12a1 1 0 00.707-1.707L16 10.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
    </svg>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

type NotifType =
  | "invite_received"
  | "invite_accepted"
  | "member_joined"
  | "error_spike"
  | "project_created"
  | "role_changed"
  | string;

const TYPE_ICON: Record<string, { icon: string; color: string }> = {
  invite_received: { icon: "✉️", color: "bg-blue-50 dark:bg-blue-900/20" },
  invite_accepted: {
    icon: "✅",
    color: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  member_joined: { icon: "👋", color: "bg-indigo-50 dark:bg-indigo-900/20" },
  error_spike: { icon: "🔴", color: "bg-red-50 dark:bg-red-900/20" },
  project_created: { icon: "📁", color: "bg-amber-50 dark:bg-amber-900/20" },
  role_changed: { icon: "🔑", color: "bg-purple-50 dark:bg-purple-900/20" },
  _default: { icon: "🔔", color: "bg-muted" },
};

function getStyle(type: NotifType) {
  return TYPE_ICON[type] ?? TYPE_ICON["_default"]!;
}

function reltime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function NotificationBell() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: count = 0 } = useQuery({
    ...trpc.notifications.unreadCount.queryOptions(),
    refetchInterval: 30_000, // poll every 30s
  });

  const { data: notifs = [], isPending } = useQuery({
    ...trpc.notifications.list.queryOptions(),
    enabled: open,
  });

  const markRead = useMutation(
    trpc.notifications.markRead.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: trpc.notifications.list.queryKey() });
        qc.invalidateQueries({
          queryKey: trpc.notifications.unreadCount.queryKey(),
        });
      },
    }),
  );

  const markAll = useMutation(
    trpc.notifications.markAllRead.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: trpc.notifications.list.queryKey() });
        qc.invalidateQueries({
          queryKey: trpc.notifications.unreadCount.queryKey(),
        });
      },
    }),
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
          "text-muted-foreground hover:bg-accent hover:text-foreground",
          open && "bg-accent text-foreground",
        )}
      >
        <BellIcon className="h-4 w-4" />
        {count > 0 && (
          <span
            aria-label={`${count} unread`}
            className={cn(
              "absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center",
              "rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground",
              "ring-2 ring-background",
            )}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className={cn(
            "absolute right-0 top-10 z-50 w-[360px] overflow-hidden",
            "rounded-xl border border-border bg-popover",
            "shadow-[0_8px_30px_rgb(0_0_0/0.12),0_0_0_1px_rgb(0_0_0/0.04)]",
            "animate-in fade-in-0 slide-in-from-top-1 duration-150",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              Notifications
            </h2>
            {count > 0 && (
              <button
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[420px] overflow-y-auto overscroll-contain">
            {isPending ? (
              <div className="space-y-1 p-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex gap-3 rounded-lg p-3 animate-pulse"
                  >
                    <div className="h-8 w-8 rounded-lg bg-muted shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-3/4 rounded bg-muted" />
                      <div className="h-2.5 w-full rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <BellIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  All caught up
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  New notifications will appear here.
                </p>
              </div>
            ) : (
              <div className="p-1.5 space-y-0.5">
                {notifs.map((n) => {
                  const style = getStyle(n.type);
                  const inner = (
                    <div
                      className={cn(
                        "flex gap-3 rounded-lg px-3 py-2.5 transition-colors cursor-pointer",
                        !n.read
                          ? "bg-primary/[0.04] hover:bg-primary/[0.07] dark:bg-primary/[0.06] dark:hover:bg-primary/[0.1]"
                          : "hover:bg-accent",
                      )}
                      onClick={() => {
                        if (!n.read) markRead.mutate({ id: n.id });
                        if (!n.link) return;
                        setOpen(false);
                      }}
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base",
                          style.color,
                        )}
                      >
                        {style.icon}
                      </div>
                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-[13px] leading-snug truncate",
                              n.read
                                ? "text-muted-foreground font-normal"
                                : "text-foreground font-medium",
                            )}
                          >
                            {n.title}
                          </p>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground mt-0.5">
                            {reltime(n.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {n.body}
                        </p>
                      </div>
                      {/* Unread dot */}
                      {!n.read && (
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary self-start" />
                      )}
                    </div>
                  );

                  return n.link ? (
                    <Link
                      key={n.id}
                      href={n.link}
                      onClick={() => setOpen(false)}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={n.id}>{inner}</div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div className="border-t border-border px-4 py-2.5 text-center">
              <span className="text-xs text-muted-foreground">
                Showing {notifs.length} notification
                {notifs.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
