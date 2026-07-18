"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  removeMemberFromTeamAction,
  removeMemberFromTeamAndWorkspaceAction,
  removeMemberFromWorkspaceAction,
} from "../_member-action";

export type RemoveMemberTarget = {
  workosUserId: string;
  name: string;
  email: string;
  teams?: { teamId: string; role: "member" | "lead" }[];
};

type Props = {
  mode: "team" | "workspace";
  member: RemoveMemberTarget | null;
  workspaceId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId?: string;
  teamName?: string;
};

function displayName(member: RemoveMemberTarget): string {
  return member.name || member.email;
}

export function RemoveMemberDialog({
  mode,
  member,
  open,
  onOpenChange,
  teamId,
  teamName,
}: Props) {
  const t = useTranslations("app.teams");
  const [pending, setPending] = useState<"team" | "team-and-workspace" | "workspace" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!member) {
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="hidden" /></Dialog>;
  }

  const name = displayName(member);
  const memberships = member.teams ?? [];
  const currentMembership = teamId
    ? memberships.find((membership) => membership.teamId === teamId)
    : undefined;
  const isLead = mode === "team"
    ? currentMembership?.role === "lead"
    : memberships.some((membership) => membership.role === "lead");
  const hasOtherTeams = mode === "team" && memberships.some(
    (membership) => membership.teamId !== teamId,
  );
  const disabledReason = isLead
    ? t("members.errors.isTeamLead", { name })
    : hasOtherTeams
      ? t("drawer.removeMemberFlow.otherTeamsBlocked")
      : null;

  async function run(action: "team" | "team-and-workspace" | "workspace") {
    if (pending || !member) return;
    setPending(action);
    setError(null);
    const result = action === "team"
      ? await removeMemberFromTeamAction({ workosUserId: member.workosUserId, teamId: teamId! })
      : action === "team-and-workspace"
        ? await removeMemberFromTeamAndWorkspaceAction({ workosUserId: member.workosUserId, teamId: teamId! })
        : await removeMemberFromWorkspaceAction({ workosUserId: member.workosUserId });
    setPending(null);
    if (result.error) {
      setError(
        result.error === "IS_TEAM_LEAD"
          ? t("members.errors.isTeamLead", { name })
          : result.error === "MEMBER_ON_OTHER_TEAMS"
            ? t("drawer.removeMemberFlow.otherTeamsBlocked")
            : t("errors.generic"),
      );
      return;
    }
    onOpenChange(false);
  }

  const isTeamMode = mode === "team";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isTeamMode
              ? t("drawer.removeMemberFlow.confirmTitle", { name, team: teamName ?? "" })
              : t("members.removeDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {isTeamMode
              ? t("drawer.removeMemberFlow.confirmDescription")
              : t("members.removeDialog.description", { name })}
          </DialogDescription>
        </DialogHeader>

        {disabledReason && (
          <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {disabledReason}
          </p>
        )}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

        <DialogFooter>
          <Button variant="outline" disabled={pending !== null} onClick={() => onOpenChange(false)}>
            {t("createDialog.cancel")}
          </Button>
          {isTeamMode ? (
            <>
              <Button variant="destructive" disabled={pending !== null || isLead} onClick={() => void run("team")}>
                {pending === "team" ? t("drawer.removeMemberFlow.removing") : t("drawer.removeMemberFlow.confirmButton")}
              </Button>
              <Button
                variant="destructive"
                disabled={pending !== null || Boolean(disabledReason)}
                aria-describedby={disabledReason ? "team-workspace-removal-help" : undefined}
                onClick={() => void run("team-and-workspace")}
              >
                {pending === "team-and-workspace"
                  ? t("drawer.removeMemberFlow.removing")
                  : t("drawer.removeMemberFlow.removeFromTeamAndWorkspace")}
              </Button>
            </>
          ) : (
            <Button variant="destructive" disabled={pending !== null || isLead} onClick={() => void run("workspace")}>
              {pending === "workspace" ? t("drawer.removeMemberFlow.removing") : t("members.removeDialog.confirm")}
            </Button>
          )}
        </DialogFooter>
        {isTeamMode && hasOtherTeams && (
          <p id="team-workspace-removal-help" className="text-xs text-muted-foreground">
            {t("drawer.removeMemberFlow.otherTeamsBlocked")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
