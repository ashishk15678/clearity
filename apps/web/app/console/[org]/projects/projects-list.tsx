"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import Link from "next/link";

// ─── Confirm delete dialog ────────────────────────────────────────────────────

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
        <p className="text-[13px] text-muted-foreground mb-5">
          <span className="font-medium text-foreground">{projectName}</span>{" "}
          and all its events, page views, sessions, and API keys will be
          permanently deleted. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "Deleting…" : "Delete project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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

  const { data: projects, isPending } = useQuery(
    trpc.projects.list.queryOptions({ organizationId }),
  );

  const create = useMutation(
    trpc.projects.create.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: trpc.projects.list.queryKey({ organizationId }),
        });
        setOpen(false);
      },
    }),
  );

  const del = useMutation(
    trpc.projects.delete.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: trpc.projects.list.queryKey({ organizationId }),
        });
        setPendingDelete(null);
      },
    }),
  );

  return (
    <div className="flex-1 p-6">
      {/* Header row */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">
            Projects
          </h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {projects?.length ?? 0} project{projects?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="primary" onClick={() => setOpen(true)} size="lg">
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          New Project
        </Button>
      </div>

      {/* List */}
      {isPending ? (
        <ProjectSkeleton />
      ) : projects?.length === 0 ? (
        <EmptyState onNew={() => setOpen(true)} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects?.map((p) => (
            <Link
              href={`/console/${orgSlug}/projects/${p.slug}`}
              className="block"
              key={p.id}
            >
              <Card className="group transition-colors hover:border-border/80 hover:bg-muted/30">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-7 w-7 shrink-0 rounded-md bg-muted border border-border flex items-center justify-center text-[11px] font-semibold text-muted-foreground uppercase">
                        {p.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-foreground">
                          {p.name}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] font-mono text-muted-foreground">
                          {p.slug}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setPendingDelete({ id: p.id, name: p.name });
                      }}
                      className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                      aria-label={`Delete ${p.name}`}
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>

                  {p.description && (
                    <p className="mt-2.5 text-[12px] text-muted-foreground line-clamp-2 pl-10">
                      {p.description}
                    </p>
                  )}

                  <div className="mt-3.5 flex items-center gap-4 text-[11px] text-muted-foreground pl-10">
                    <span className="tabular-nums">
                      {p._count.events.toLocaleString()} events
                    </span>
                    <span className="tabular-nums">
                      {p._count.pageViews.toLocaleString()} views
                    </span>
                    <span>
                      {p._count.apiKeys} key{p._count.apiKeys !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <CreateProjectDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreate={(data) => create.mutate({ ...data, organizationId })}
        isPending={create.isPending}
        error={create.error?.message}
      />

      {/* Delete confirmation dialog */}
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

// ─── Create dialog ─────────────────────────────────────────────────────────

function CreateProjectDialog({
  open,
  onClose,
  onCreate,
  isPending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    description?: string;
    url?: string;
  }) => void;
  isPending: boolean;
  error?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <h3 className="mb-5 text-[15px] font-semibold text-foreground">
          New Project
        </h3>
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
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required placeholder="My App" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              name="description"
              placeholder="What does this project track?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              name="url"
              type="url"
              placeholder="https://myapp.com"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "Creating…" : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border rounded-lg bg-card">
      <h3 className="text-[13px] font-semibold text-foreground">
        No projects yet
      </h3>
      <p className="mt-1 text-[12px] text-muted-foreground max-w-xs">
        Create a project to start tracking events and page views with the Ingest
        API.
      </p>
      <Button variant="primary" className="mt-6" onClick={onNew}>
        Create your first project
      </Button>
    </div>
  );
}

function ProjectSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-lg border border-border p-4 space-y-3 animate-pulse"
        >
          <div className="h-4 w-2/3 rounded bg-muted" />
          <div className="h-3 w-1/3 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted mt-4" />
        </div>
      ))}
    </div>
  );
}
