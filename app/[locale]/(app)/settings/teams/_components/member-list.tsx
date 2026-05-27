"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, MoreHorizontal, Settings2, UserX, MailX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TeamAssignmentModal, type AssignableTeam, type MemberSummary } from "./team-assignment-modal";
import { removeMemberFromWorkspaceAction } from "../_member-action";
import { revokeInviteAction } from "../_invite-action";

export type PendingInviteRow = {
  email: string;
  teamIds: string[];
  leadOnTeamIds: string[];
  invitedAt: string;
};

type MemberListProps = {
  members: MemberSummary[];
  pendingInvites: PendingInviteRow[];
  teams: AssignableTeam[];
  ownerClerkUserId: string;
};

export function MemberList({
  members,
  pendingInvites,
  teams,
  ownerClerkUserId,
}: MemberListProps) {
  const t = useTranslations("app.settings.teams");
  const [assignmentTarget, setAssignmentTarget] = useState<MemberSummary | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberSummary | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PendingInviteRow | null>(null);
  const [pending, startTransition] = useTransition();

  const teamById = new Map(teams.map((tm) => [tm.id, tm]));

  function handleRemoveMember() {
    if (!removeTarget) return;
    startTransition(async () => {
      const result = await removeMemberFromWorkspaceAction({
        clerkUserId: removeTarget.clerkUserId,
      });
      if (result.error) {
        toast.error(
          result.error === "CANNOT_REMOVE_OWNER"
            ? t("members.errors.cannotRemoveOwner")
            : t("errors.generic"),
        );
        return;
      }
      toast.success(t("members.toasts.removed"));
      setRemoveTarget(null);
    });
  }

  function handleRevokeInvite() {
    if (!revokeTarget) return;
    startTransition(async () => {
      const result = await revokeInviteAction({ email: revokeTarget.email });
      if (result.error) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("invite.toasts.revoked"));
      setRevokeTarget(null);
    });
  }

  const hasAny = members.length > 0 || pendingInvites.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("members.heading")}
        </h3>
      </div>

      {!hasAny ? (
        <p className="text-sm text-muted-foreground">{t("members.empty")}</p>
      ) : (
        <div className="border border-border">
          {members.map((m) => {
            const isOwner = m.clerkUserId === ownerClerkUserId;
            const memberTeams = m.teams
              .map((tm) => teamById.get(tm.teamId))
              .filter((t): t is AssignableTeam => Boolean(t));
            return (
              <div
                key={m.clerkUserId}
                className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-0"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {m.name || m.email}
                    </span>
                    {isOwner ? (
                      <Badge variant="secondary" className="text-xs">
                        {t("members.ownerBadge")}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="truncate">{m.email}</span>
                    {memberTeams.length > 0 && <span aria-hidden="true">·</span>}
                    {memberTeams.map((team) => {
                      const role = m.teams.find((tm) => tm.teamId === team.id)?.role;
                      return (
                        <span
                          key={team.id}
                          className="inline-flex items-center gap-1 border border-border px-1.5 py-0.5"
                          style={{ borderLeft: `3px solid ${team.color}` }}
                        >
                          {team.name}
                          {role === "lead" && (
                            <span className="text-[10px] uppercase text-foreground">
                              · {t("members.leadBadge")}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {!isOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-11 shrink-0"
                          aria-label={t("members.rowActionsLabel", {
                            name: m.name || m.email,
                          })}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" side="bottom">
                      <DropdownMenuItem onSelect={() => setAssignmentTarget(m)}>
                        <Settings2 className="size-4" />
                        {t("members.manageTeams")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setRemoveTarget(m)}
                      >
                        <UserX className="size-4" />
                        {t("members.removeFromWorkspace")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}

          {pendingInvites.map((invite) => {
            const inviteTeams = invite.teamIds
              .map((id) => teamById.get(id))
              .filter((t): t is AssignableTeam => Boolean(t));
            return (
              <div
                key={invite.email}
                className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-0"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-muted-foreground">
                      {invite.email}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {t("members.pendingBadge")}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {inviteTeams.map((team) => (
                      <span
                        key={team.id}
                        className="inline-flex items-center gap-1 border border-border px-1.5 py-0.5"
                        style={{ borderLeft: `3px solid ${team.color}` }}
                      >
                        {team.name}
                      </span>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  aria-label={t("members.revokeInvite")}
                  onClick={() => setRevokeTarget(invite)}
                >
                  <MailX className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {assignmentTarget && (
        <TeamAssignmentModal
          open={Boolean(assignmentTarget)}
          onOpenChange={(open) => !open && setAssignmentTarget(null)}
          member={assignmentTarget}
          teams={teams}
          onChanged={() => {
            // Server-side revalidatePath in the action refreshes the parent;
            // closing here would lose the dialog before the user is done.
          }}
        />
      )}

      <Dialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && !pending && setRemoveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("members.removeDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("members.removeDialog.description", {
                name: removeTarget?.name || removeTarget?.email || "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setRemoveTarget(null)}
            >
              {t("deleteDialog.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={handleRemoveMember}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t("deleteDialog.deleting")}
                </>
              ) : (
                t("members.removeDialog.confirm")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && !pending && setRevokeTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("invite.revokeDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("invite.revokeDialog.description", {
                email: revokeTarget?.email ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setRevokeTarget(null)}
            >
              {t("deleteDialog.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={handleRevokeInvite}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t("deleteDialog.deleting")}
                </>
              ) : (
                t("invite.revokeDialog.confirm")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
