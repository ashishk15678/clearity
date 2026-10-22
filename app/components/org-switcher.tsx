"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Building2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

export function OrgSwitcher() {
  const router = useRouter();
  const params = useParams<{ org?: string }>();
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const { data: orgs = [], isPending } = useQuery(trpc.org.list.queryOptions());

  // Active org = URL param → first org
  const activeSlug = params?.org ?? orgs[0]?.slug;
  const activeOrg = orgs.find((o) => o.slug === activeSlug) ?? orgs[0];

  const create = useMutation(
    trpc.org.create.mutationOptions({
      onSuccess: (org) => {
        qc.invalidateQueries({ queryKey: trpc.org.list.queryKey() });
        setCreateOpen(false);
        setName("");
        setSlug("");
        setSlugTouched(false);
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

  const selectOrg = (s: string) => {
    router.push(`/console/${s}`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              className={cn(
                "flex h-8 min-w-0 max-w-[180px] items-center gap-2 rounded-lg px-2.5",
                "bg-muted/60 hover:bg-muted text-foreground text-sm font-medium",
                "border border-border/50 transition-colors outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring",
              )}
              aria-label="Switch organization"
            >
              {isPending ? (
                <span className="h-5 w-5 rounded-md bg-muted animate-pulse" />
              ) : activeOrg ? (
                <OrgAvatar name={activeOrg.name} />
              ) : (
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate text-xs">
                {activeOrg?.name ?? "No org"}
              </span>
              <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground ml-auto" />
            </button>
          }
        />

        <DropdownMenuContent side="bottom" align="start" className="w-56">
          {orgs.length > 0 && (
            <>
              <p className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Organizations
              </p>
              <DropdownMenuGroup>
                {orgs.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => selectOrg(org.slug)}
                    className="gap-2.5"
                  >
                    <OrgAvatar name={org.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{org.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {org.members[0]?.role ?? "MEMBER"}
                      </p>
                    </div>
                    {org.slug === activeSlug && (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onClick={() => setCreateOpen(true)}
            className="gap-2.5 text-primary font-medium"
          >
            <Plus className="h-4 w-4" />
            New Organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create org dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              A workspace for your team to manage projects and track analytics.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name || !slug) return;
              create.mutate({ name, slug });
            }}
            className="space-y-4 pt-2"
          >
            {create.error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {create.error.message}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                placeholder="Acme Corp"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
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
                  className="font-mono pr-28"
                  required
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                  .clarity.app
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens only.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={create.isPending || !name || !slug}
              >
                {create.isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OrgAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md";
}) {
  const letter = name.charAt(0).toUpperCase();
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold",
        size === "sm" ? "h-5 w-5 text-[10px]" : "h-5 w-5 text-xs",
      )}
    >
      {letter}
    </span>
  );
}
