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
      },
    }),
  );

  return (
    <div className="flex-1 p-6">
      {/* Header row */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Projects
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {projects?.length ?? 0} project{projects?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setOpen(true)}
          size="lg"
          className="font-extrabold"
        >
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
              className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50 hover:text-indigo-600 dark:hover:text-indigo-400"
              key={p.id}
            >
              <Card className="group transition-colors">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {p.name}
                      <p className="mt-0.5 truncate text-xs text-zinc-400">
                        {p.slug}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        del.mutate({ id: p.id });
                      }}
                      className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 transition-all"
                      aria-label="Delete project"
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
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {p.description}
                    </p>
                  )}

                  <div className="mt-4 flex items-center gap-4 text-xs text-zinc-400">
                    <span className="flex items-center gap-1">
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
                      </svg>
                      {p._count.events} events
                    </span>
                    <span className="flex items-center gap-1">
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path
                          fillRule="evenodd"
                          d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {p._count.pageViews} views
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
        <h3 className="mb-5 text-base font-semibold text-zinc-900 dark:text-zinc-50">
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
            <p className="rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-600 dark:text-red-400">
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
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-900/20">
        <svg
          className="h-8 w-8 text-indigo-500"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        No projects yet
      </h3>
      <p className="mt-1 text-sm text-zinc-500 max-w-xs">
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
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3 animate-pulse"
        >
          <div className="h-4 w-2/3 rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-3 w-1/3 rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-3 w-full rounded bg-zinc-100 dark:bg-zinc-800 mt-4" />
        </div>
      ))}
    </div>
  );
}
