"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

// ─── Types (mirrored from Prisma return) ─────────────────────────────────────

type OrgUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

type OrgMember = {
  id: string;
  role: string;
  userId: string;
  user: OrgUser;
};

type TeamMemberRow = {
  id: string;
  role: string;
  member: { id: string; userId: string; user: OrgUser };
};

type Team = {
  id: string;
  name: string;
  description?: string | null;
  _count: { members: number };
  members: TeamMemberRow[];
};

type Invite = {
  id: string;
  email: string;
  role: string;
  expiresAt: Date | string;
  invitedBy: { name: string; email: string };
};

type Org = {
  id: string;
  name: string;
  slug: string;
  members: OrgMember[];
  teams: Team[];
  invites: Invite[];
};

type MyMembership = { id: string; role: string; userId: string };

// ─── Role helpers ─────────────────────────────────────────────────────────────

const ROLE_RANK: Record<string, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};
const canAdmin = (role: string) => (ROLE_RANK[role] ?? 0) >= ROLE_RANK.ADMIN;

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  ADMIN: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
  MEMBER: "bg-muted text-muted-foreground",
  VIEWER: "bg-muted text-muted-foreground",
  LEAD: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300",
};

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = "members" | "teams" | "invites";
// ─── Main component ───────────────────────────────────────────────────────────

export function TeamsView({
  org: initialOrg,
  myMembership,
  currentUserId,
}: {
  org: Org;
  myMembership: MyMembership;
  currentUserId: string;
}) {
  const [tab, setTab] = useState<Tab>("members");
  const isAdmin = canAdmin(myMembership.role);

  return (
    <div className="flex-1 p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {initialOrg.name}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {initialOrg.members.length} member
            {initialOrg.members.length !== 1 ? "s" : ""} ·{" "}
            {initialOrg.teams.length} team
            {initialOrg.teams.length !== 1 ? "s" : ""}
          </p>
        </div>
        <RolePill role={myMembership.role} />
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-6">
          {(["members", "teams", "invites"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 pb-2.5 text-sm font-medium capitalize transition-colors",
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
              {t === "invites" && initialOrg.invites.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                  {initialOrg.invites.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab panels */}
      {tab === "members" && (
        <MembersTab
          org={initialOrg}
          myMembership={myMembership}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
        />
      )}
      {tab === "teams" && (
        <TeamsTab
          org={initialOrg}
          myMembership={myMembership}
          isAdmin={isAdmin}
        />
      )}
      {tab === "invites" && (
        <InvitesTab
          org={initialOrg}
          myMembership={myMembership}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

// ─── Members tab ──────────────────────────────────────────────────────────────

function MembersTab({
  org,
  myMembership,
  currentUserId,
  isAdmin,
}: {
  org: Org;
  myMembership: MyMembership;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);

  const updateRole = useMutation(
    trpc.org.updateMemberRole.mutationOptions({
      onSuccess: () =>
        qc.invalidateQueries({
          queryKey: trpc.org.bySlug.queryKey({ slug: org.slug }),
        }),
    }),
  );

  const removeMember = useMutation(
    trpc.org.removeMember.mutationOptions({
      onSuccess: () =>
        qc.invalidateQueries({
          queryKey: trpc.org.bySlug.queryKey({ slug: org.slug }),
        }),
    }),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {org.members.length} members
        </p>
        {isAdmin && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setInviteOpen(true)}
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
            </svg>
            Invite member
          </Button>
        )}
      </div>

      <div className="rounded-xl bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Member
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Role
              </th>
              {isAdmin && <th className="px-5 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {org.members.map((m) => (
              <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.user.name} />
                    <div>
                      <p className="font-medium text-foreground">
                        {m.user.name}
                        {m.userId === currentUserId && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.user.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  {isAdmin &&
                  m.userId !== currentUserId &&
                  m.role !== "OWNER" ? (
                    <RoleSelect
                      value={m.role}
                      onChange={(role) =>
                        updateRole.mutate({
                          organizationId: org.id,
                          userId: m.userId,
                          role: role as any,
                        })
                      }
                      options={["ADMIN", "MEMBER", "VIEWER"]}
                    />
                  ) : (
                    <RolePill role={m.role} />
                  )}
                </td>
                {isAdmin && (
                  <td className="px-5 py-3 text-right">
                    {m.userId !== currentUserId && m.role !== "OWNER" && (
                      <button
                        onClick={() =>
                          removeMember.mutate({
                            organizationId: org.id,
                            userId: m.userId,
                          })
                        }
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InviteMemberDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        organizationId={org.id}
        orgSlug={org.slug}
      />
    </div>
  );
}

// ─── Teams tab ────────────────────────────────────────────────────────────────

function TeamsTab({
  org,
  myMembership,
  isAdmin,
}: {
  org: Org;
  myMembership: MyMembership;
  isAdmin: boolean;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [addMemberTeam, setAddMemberTeam] = useState<Team | null>(null);

  const createTeam = useMutation(
    trpc.org.createTeam.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: trpc.org.bySlug.queryKey({ slug: org.slug }),
        });
        setCreateOpen(false);
      },
    }),
  );

  const deleteTeam = useMutation(
    trpc.org.deleteTeam.mutationOptions({
      onSuccess: () =>
        qc.invalidateQueries({
          queryKey: trpc.org.bySlug.queryKey({ slug: org.slug }),
        }),
    }),
  );

  const removeTeamMember = useMutation(
    trpc.org.removeTeamMember.mutationOptions({
      onSuccess: () =>
        qc.invalidateQueries({
          queryKey: trpc.org.bySlug.queryKey({ slug: org.slug }),
        }),
    }),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {org.teams.length} teams
        </p>
        {isAdmin && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            New team
          </Button>
        )}
      </div>

      {org.teams.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No teams yet"
          description="Teams help you group members and manage permissions more granularly."
          action={
            isAdmin
              ? {
                  label: "Create first team",
                  onClick: () => setCreateOpen(true),
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {org.teams.map((team) => (
            <div
              key={team.id}
              className="rounded-xl bg-card shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <p className="font-semibold text-foreground">{team.name}</p>
                  {team.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {team.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {team._count.members} member
                    {team._count.members !== 1 ? "s" : ""}
                  </span>
                  {isAdmin && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setAddMemberTeam(team)}
                      >
                        Add
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteTeam.mutate({ teamId: team.id })}
                        className="text-destructive hover:text-destructive"
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {team.members.length > 0 && (
                <div className="divide-y divide-border">
                  {team.members.map((tm) => (
                    <div
                      key={tm.id}
                      className="flex items-center justify-between px-5 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={tm.member.user.name} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {tm.member.user.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tm.member.user.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <RolePill role={tm.role} />
                        {isAdmin && (
                          <button
                            onClick={() =>
                              removeTeamMember.mutate({
                                teamId: team.id,
                                userId: tm.member.userId,
                              })
                            }
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Project access section */}
              <TeamPermissionsSection
                team={team}
                orgId={org.id}
                orgSlug={org.slug}
                isAdmin={isAdmin}
              />
            </div>
          ))}
        </div>
      )}

      {/* Create team dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Team</DialogTitle>
            <DialogDescription>
              Group members to share access and permissions.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              createTeam.mutate({
                organizationId: org.id,
                name: fd.get("name") as string,
                description: (fd.get("description") as string) || undefined,
              });
            }}
            className="space-y-4 pt-2"
          >
            {createTeam.error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {createTeam.error.message}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="team-name">Name</Label>
              <Input
                id="team-name"
                name="name"
                required
                placeholder="Engineering"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-desc">Description (optional)</Label>
              <Input
                id="team-desc"
                name="description"
                placeholder="What does this team work on?"
              />
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
                disabled={createTeam.isPending}
              >
                {createTeam.isPending ? "Creating…" : "Create Team"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add member to team dialog */}
      {addMemberTeam && (
        <AddTeamMemberDialog
          team={addMemberTeam}
          orgId={org.id}
          orgSlug={org.slug}
          members={org.members.filter(
            (m) =>
              !addMemberTeam.members.some(
                (tm) => tm.member.userId === m.userId,
              ),
          )}
          onClose={() => setAddMemberTeam(null)}
        />
      )}
    </div>
  );
}

// ─── Invites tab ──────────────────────────────────────────────────────────────

function InvitesTab({
  org,
  myMembership,
  isAdmin,
}: {
  org: Org;
  myMembership: MyMembership;
  isAdmin: boolean;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);

  const revoke = useMutation(
    trpc.org.revokeInvite.mutationOptions({
      onSuccess: () =>
        qc.invalidateQueries({
          queryKey: trpc.org.bySlug.queryKey({ slug: org.slug }),
        }),
    }),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {org.invites.length} pending invite
          {org.invites.length !== 1 ? "s" : ""}
        </p>
        {isAdmin && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setInviteOpen(true)}
          >
            Send invite
          </Button>
        )}
      </div>

      {org.invites.length === 0 ? (
        <EmptyState
          icon="✉️"
          title="No pending invites"
          description="Invite team members by email to collaborate."
          action={
            isAdmin
              ? { label: "Send an invite", onClick: () => setInviteOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="rounded-xl bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Email
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Role
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Invited by
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Expires
                </th>
                {isAdmin && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {org.invites.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="px-5 py-3 font-medium text-foreground">
                    {inv.email}
                  </td>
                  <td className="px-5 py-3">
                    <RolePill role={inv.role} />
                  </td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">
                    {inv.invitedBy.name}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => revoke.mutate({ inviteId: inv.id })}
                        className="text-xs text-destructive hover:underline"
                      >
                        Revoke
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InviteMemberDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        organizationId={org.id}
        orgSlug={org.slug}
      />
    </div>
  );
}

// ─── Invite member dialog ─────────────────────────────────────────────────────

function InviteMemberDialog({
  open,
  onClose,
  organizationId,
  orgSlug,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  orgSlug: string;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const invite = useMutation(
    trpc.org.invite.mutationOptions({
      onSuccess: (data) => {
        qc.invalidateQueries({
          queryKey: trpc.org.bySlug.queryKey({ slug: orgSlug }),
        });
        setInviteUrl(data.inviteUrl);
      },
    }),
  );

  const handleClose = () => {
    setInviteUrl(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
          <DialogDescription>
            Send an email invitation. The link expires in 7 days.
          </DialogDescription>
        </DialogHeader>

        {inviteUrl ? (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-foreground font-medium">
              Invitation created ✓
            </p>
            <p className="text-xs text-muted-foreground">
              Share this link with the invitee (email delivery coming soon):
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-xs font-mono text-foreground break-all">
                {typeof window !== "undefined"
                  ? `${window.location.origin}${inviteUrl}`
                  : inviteUrl}
              </code>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    navigator.clipboard.writeText(
                      `${window.location.origin}${inviteUrl}`,
                    );
                  }
                }}
              >
                Copy
              </Button>
            </div>
            <DialogFooter>
              <Button variant="primary" onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              invite.mutate({
                organizationId,
                email: fd.get("email") as string,
                role: fd.get("role") as any,
              });
            }}
            className="space-y-4 pt-2"
          >
            {invite.error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {invite.error.message}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                required
                placeholder="colleague@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                name="role"
                defaultValue="MEMBER"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="ADMIN">
                  Admin — can manage projects and members
                </option>
                <option value="MEMBER">
                  Member — can view and create projects
                </option>
                <option value="VIEWER">Viewer — read-only access</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={invite.isPending}
              >
                {invite.isPending ? "Sending…" : "Send Invite"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Add team member dialog ───────────────────────────────────────────────────

function AddTeamMemberDialog({
  team,
  orgId,
  orgSlug,
  members,
  onClose,
}: {
  team: Team;
  orgId: string;
  orgSlug: string;
  members: OrgMember[];
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const add = useMutation(
    trpc.org.addTeamMember.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({
          queryKey: trpc.org.bySlug.queryKey({ slug: orgSlug }),
        });
        onClose();
      },
    }),
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to {team.name}</DialogTitle>
          <DialogDescription>
            Select an org member to add to this team.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            add.mutate({
              teamId: team.id,
              userId: fd.get("userId") as string,
              role: fd.get("role") as any,
            });
          }}
          className="space-y-4 pt-2"
        >
          {add.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {add.error.message}
            </p>
          )}
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              All org members are already in this team.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="add-user">Member</Label>
                <select
                  id="add-user"
                  name="userId"
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.userId}>
                      {m.user.name} ({m.user.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="team-role">Team role</Label>
                <select
                  id="team-role"
                  name="role"
                  defaultValue="MEMBER"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="LEAD">Lead</option>
                  <option value="MEMBER">Member</option>
                </select>
              </div>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {members.length > 0 && (
              <Button type="submit" variant="primary" disabled={add.isPending}>
                {add.isPending ? "Adding…" : "Add to team"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function RolePill({ role }: { role: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        ROLE_COLORS[role] ?? "bg-muted text-muted-foreground",
      )}
    >
      {role}
    </span>
  );
}

function RoleSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

// ─── Team permissions collapsible section ─────────────────────────────────────

function TeamPermissionsSection({
  team,
  orgId,
  orgSlug,
  isAdmin,
}: {
  team: Team;
  orgId: string;
  orgSlug: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/30 transition-colors uppercase tracking-wider"
        aria-expanded={open}
      >
        Project access
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open ? "rotate-180" : "",
          )}
        >
          <path d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z" />
        </svg>
      </button>
      {open && (
        <TeamPermissionsPanel
          team={team}
          orgId={orgId}
          orgSlug={orgSlug}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

// ─── Team permissions panel ───────────────────────────────────────────────────

function TeamPermissionsPanel({
  team,
  orgId,
  orgSlug,
  isAdmin,
}: {
  team: Team;
  orgId: string;
  orgSlug: string;
  isAdmin: boolean;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const { data: accesses, isPending } = useQuery(
    trpc.org.listTeamProjectAccess.queryOptions({ teamId: team.id }),
  );

  // Projects for this org are fetched via the projects router
  const { data: projects } = useQuery(
    trpc.projects.list.queryOptions({ organizationId: orgId }),
  );

  const setAccess = useMutation(
    trpc.org.setTeamProjectAccess.mutationOptions({
      onSuccess: () =>
        qc.invalidateQueries({
          queryKey: trpc.org.listTeamProjectAccess.queryKey({
            teamId: team.id,
          }),
        }),
    }),
  );

  const accessMap = new Map(
    (accesses ?? []).map((a) => [a.projectId, a.access]),
  );

  const ACCESS_LEVELS = [
    { value: null, label: "No access" },
    { value: "VIEWER", label: "Viewer — read-only" },
    { value: "MEMBER", label: "Member — can create" },
    { value: "ADMIN", label: "Admin — full control" },
  ] as const;

  if (isPending || !projects) {
    return (
      <div className="px-5 py-3 text-xs text-muted-foreground">Loading…</div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="px-5 py-3 text-xs text-muted-foreground">
        No projects in this org yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {projects.map((p) => {
        const current = accessMap.get(p.id) ?? null;
        return (
          <div
            key={p.id}
            className="flex items-center justify-between px-5 py-2.5 gap-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {p.name}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                {p.slug}
              </p>
            </div>
            {isAdmin ? (
              <select
                value={current ?? ""}
                onChange={(e) =>
                  setAccess.mutate({
                    teamId: team.id,
                    projectId: p.id,
                    access: (e.target.value || null) as
                      "VIEWER" | "MEMBER" | "ADMIN" | null,
                  })
                }
                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label={`Access level for ${p.name}`}
              >
                {ACCESS_LEVELS.map((l) => (
                  <option key={String(l.value)} value={l.value ?? ""}>
                    {l.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-muted-foreground">
                {current ?? "No access"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold",
        size === "sm" ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm",
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl bg-card shadow-sm">
      <span className="text-4xl mb-3">{icon}</span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground max-w-xs">
        {description}
      </p>
      {action && (
        <Button
          variant="primary"
          size="sm"
          className="mt-5"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
