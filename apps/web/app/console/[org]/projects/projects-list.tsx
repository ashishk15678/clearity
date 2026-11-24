"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import Link from "next/link";

// ─── Confirm delete ───────────────────────────────────────────────────────────

function ConfirmDeleteDialog({
  projectName,
  onConfirm,
  onCancel,
  isPending,
}: {
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent>
        <h3 className="text-[15px] font-semibold text-foreground mb-1">
          Delete project?
        </h3>
        <p className="text-[13px] text-muted-foreground mb-6">
          <span className="font-semibold text-foreground">{projectName}</span>{" "}
          and all its events, page views, sessions, and API keys will be
          permanently deleted. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Deleting…" : "Delete project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Projects list ────────────────────────────────────────────────────────────

export function ProjectsList({
  orgSlug,
  organizationId,
}: {
  orgSlug: string;
  organizationId: string;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");

  const { data: projects, isPending } = useQuery(
    trpc.projects.list.queryOptions({ organizationId }),
  );

  const create = useMutation(
    trpc.projects.create.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: trpc.projects.list.queryKey({ organizationId }) });
        setOpen(false);
      },
    }),
  );

  const del = useMutation(
    trpc.projects.delete.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: trpc.projects.list.queryKey({ organizationId }) });
        setPendingDelete(null);
      },
    }),
  );

  const filtered = (projects ?? []).filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex-1 p-6 max-w-5xl">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
            Projects
          </h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {projects?.length ?? 0} project{(projects?.length ?? 0) !== 1 ? "s" : ""} in this workspace
          </p>
        </div>
        <Button variant="primary" onClick={() => setOpen(true)} size="md">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New project
        </Button>
      </div>

      {/* Search + filter bar */}
      {(projects?.length ?? 0) > 0 && (
        <div className="mb-4">
          <input
            type="search"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-border bg-card px-3.5 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
          />
        </div>
      )}

      {/* Table */}
      {isPending ? (
        <TableSkeleton />
      ) : (projects?.length ?? 0) === 0 ? (
        <EmptyState onNew={() => setOpen(true)} />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_72px_72px_64px_36px] items-center gap-3 px-4 py-2.5 bg-muted/40 border-b border-border">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Name</span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground text-right hidden sm:block">Events</span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground text-right hidden sm:block">Views</span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground text-right hidden sm:block">Keys</span>
            <span />
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-muted-foreground bg-card">
              No projects match &ldquo;{search}&rdquo;
            </div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_72px_72px_64px_36px] items-center gap-3 px-4 py-3 border-b border-border last:border-0 bg-card hover:bg-muted/30 transition-colors group"
              >
                {/* Name */}
                <Link
                  href={`/console/${orgSlug}/projects/${p.slug}`}
                  className="flex items-center gap-3 min-w-0"
                >
                  <div className="h-7 w-7 shrink-0 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary uppercase">
                    {p.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {p.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono leading-none mt-0.5 truncate">
                      {p.slug}
                    </p>
                  </div>
                </Link>

                {/* Counts */}
                <span className="hidden sm:block text-[13px] tabular-nums text-muted-foreground text-right">{fmtCompact(p._count.events)}</span>
                <span className="hidden sm:block text-[13px] tabular-nums text-muted-foreground text-right">{fmtCompact(p._count.pageViews)}</span>
                <span className="hidden sm:block text-[13px] tabular-nums text-muted-foreground text-right">{p._count.apiKeys}</span>

                {/* Delete */}
                <button
                  onClick={() => setPendingDelete({ id: p.id, name: p.name })}
                  className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all justify-self-end"
                  aria-label={`Delete ${p.name}`}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <CreateProjectDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreate={(data) => create.mutate({ ...data, organizationId })}
        isPending={create.isPending}
        error={create.error?.message}
      />

      {pendingDelete && (
        <ConfirmDeleteDialog
          projectName={pendingDelete.name}
          isPending={del.isPending}
          onConfirm={() => del.mutate({ id: pendingDelete.id })}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

// ─── Create dialog ────────────────────────────────────────────────────────────

function CreateProjectDialog({
  open, onClose, onCreate, isPending, error,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; description?: string; url?: string }) => void;
  isPending: boolean;
  error?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <h3 className="mb-5 text-[16px] font-semibold text-foreground">New project</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onCreate({
              name: fd.get("name") as string,
              description: (fd.get("description") as string) || undefined,
              url: (fd.get("url") as string) || undefined,
            });
          }}
          className="space-y-4"
        >
          {error && (
            <p className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-[12px] text-destructive">
              {error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="name">Name <span className="text-muted-foreground">*</span></Label>
            <Input id="name" name="name" required placeholder="My app…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" placeholder="What does this project track?" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="url">URL</Label>
            <Input id="url" name="url" type="url" placeholder="https://myapp.com" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Empty + Skeleton ─────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-border bg-card gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
        <svg className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      </div>
      <div>
        <p className="text-[14px] font-semibold text-foreground">No projects yet</p>
        <p className="mt-1 text-[12px] text-muted-foreground max-w-xs">
          Create a project to start tracking events and page views.
        </p>
      </div>
      <Button variant="primary" onClick={onNew}>Create your first project</Button>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-xl border border-border overflow-hidden animate-pulse">
      <div className="h-9 bg-muted/40 border-b border-border" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="grid grid-cols-[1fr_72px_72px_64px_36px] items-center gap-3 px-4 py-3 border-b last:border-0 border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-muted" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 w-28 rounded bg-muted" />
              <div className="h-2.5 w-20 rounded bg-muted" />
            </div>
          </div>
          <div className="hidden sm:block h-3 w-10 rounded bg-muted ml-auto" />
          <div className="hidden sm:block h-3 w-10 rounded bg-muted ml-auto" />
          <div className="hidden sm:block h-3 w-6 rounded bg-muted ml-auto" />
          <div />
        </div>
      ))}
    </div>
  );
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}
