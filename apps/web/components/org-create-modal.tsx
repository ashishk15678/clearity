"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BorderBeam } from "./border-beam";

export function OrgCreateModal() {
  const router = useRouter();
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const create = useMutation(
    trpc.org.create.mutationOptions({
      onSuccess: (org) => {
        qc.invalidateQueries({ queryKey: trpc.org.list.queryKey() });
        router.push(`/console/${org.slug}`);
      },
    }),
  );

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) {
      setSlug(
        v
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
      );
    }
  };

  const handleSlugChange = (v: string) => {
    setSlugTouched(true);
    setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-linear-to-b from-zinc-100 to-zinc-200">
      {/* Actual Modal Card */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-card border border-border shadow-lg p-8">
        {/* Background Monochrome Cake Watermark ON the modal */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-10 -right-10 flex items-center justify-center select-none"
        >
          <span className="text-[280px] leading-none -rotate-12 brightness-0 opacity-[0.06]">
            🎂
          </span>
        </div>

        {/* Foreground Modal Content */}
        <div className="relative z-10 space-y-6">
          {/* Icon + heading */}
          <div className="flex flex-col items-center text-center gap-3">
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Create your organization
              </h1>
              <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                An organization is your workspace for projects, analytics, and
                your team.
              </p>
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name || !slug) return;
              create.mutate({ name, slug });
            }}
            className="space-y-4"
          >
            {create.error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {create.error.message}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="org-name">Organization name</Label>
              <Input
                id="org-name"
                placeholder="Acme Corp"
                value={name}
                className="py-0 bg-card/80"
                onChange={(e) => handleNameChange(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="org-slug">Slug</Label>
              <div className="relative">
                <Input
                  id="org-slug"
                  placeholder="acme"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className="font-mono pr-28 bg-card/80"
                  required
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                  .clarity.app
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens only. Cannot be changed
                later.
              </p>
            </div>
            <BorderBeam className="w-full">
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={create.isPending || !name || !slug}
              >
                {create.isPending ? "Creating…" : "Create organization"}
              </Button>
            </BorderBeam>
          </form>
        </div>
      </div>
    </div>
  );
}
