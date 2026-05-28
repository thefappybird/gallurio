"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  assignMemberToTeamAction,
  removeMemberFromTeamAction,
  setLeadFlagAction,
} from "../_member-action";

export type AssignableTeam = {
  id: string;
  name: string;
  color: string;
  memberCount: number;
  maxMembersPerTeam: number;
};

export type MemberSummary = {
  clerkUserId: string;
  email: string;
  name: string;
  teams: { teamId: string; role: "member" | "lead" }[];
};

type TeamAssignmentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MemberSummary;
  teams: AssignableTeam[];
  onChanged?: () => void;
};

export function TeamAssignmentModal({
  open,
  onOpenChange,
  member,
  teams,
  onChanged,
}: TeamAssignmentModalProps) {
  const t = useTranslations("app.settings.teams");
  const [pending, startTransition] = useTransition();
  const [busyTeamId, setBusyTeamId] = useState<string | null>(null);

  const memberTeamMap = new Map(member.teams.map((tm) => [tm.teamId, tm.role]));

  function handleAssign(teamId: string, isLead: boolean) {
    setBusyTeamId(teamId);
    startTransition(async () => {
      const result = await assignMemberToTeamAction({
        clerkUserId: member.clerkUserId,
        teamId,
        role: isLead ? "lead" : "member",
      });
      setBusyTeamId(null);
      if (result.error) {
        if (result.error === "TEAM_SEAT_CAP_EXCEEDED") {
          toast.error(t("invite.errors.teamFull", { teams: "" }));
        } else if (result.error === "ALREADY_ON_TEAM") {
          toast.error(t("assignment.errors.alreadyOnTeam"));
        } else {
          toast.error(t("errors.generic"));
        }
        return;
      }
      toast.success(t("assignment.toasts.added"));
      onChanged?.();
    });
  }

  function handleRemove(teamId: string) {
    setBusyTeamId(teamId);
    startTransition(async () => {
      const result = await removeMemberFromTeamAction({
        clerkUserId: member.clerkUserId,
        teamId,
      });
      setBusyTeamId(null);
      if (result.error) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("assignment.toasts.removed"));
      onChanged?.();
    });
  }

  function handleSetLead(teamId: string, isLead: boolean) {
    setBusyTeamId(teamId);
    startTransition(async () => {
      const result = await setLeadFlagAction({
        clerkUserId: member.clerkUserId,
        teamId,
        isLead,
      });
      setBusyTeamId(null);
      if (result.error) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(
        isLead ? t("assignment.toasts.promoted") : t("assignment.toasts.demoted"),
      );
      onChanged?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("assignment.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("assignment.dialog.description", {
              name: member.name || member.email,
            })}
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-2 border border-border bg-card p-1">
          {teams.map((team) => {
            const currentRole = memberTeamMap.get(team.id);
            const isMember = currentRole !== undefined;
            const isLead = currentRole === "lead";
            const atCap = team.memberCount >= team.maxMembersPerTeam;
            const busy = busyTeamId === team.id;

            return (
              <li
                key={team.id}
                className="flex items-center gap-3 border border-transparent bg-background px-3 py-2 hover:border-border"
              >
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: team.color, width: 14, height: 14 }}
                  className="shrink-0"
                />
                <div className="flex-1 text-sm">
                  <div className="font-medium">{team.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {team.memberCount}/{team.maxMembersPerTeam}
                  </div>
                </div>

                {isMember ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`assign-lead-${team.id}`}
                        className="text-xs text-muted-foreground"
                      >
                        {t("invite.dialog.leadLabel")}
                      </Label>
                      <Switch
                        id={`assign-lead-${team.id}`}
                        checked={isLead}
                        disabled={busy}
                        onCheckedChange={(v) => handleSetLead(team.id, v)}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => handleRemove(team.id)}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        t("assignment.dialog.remove")
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    disabled={busy || atCap}
                    onClick={() => handleAssign(team.id, false)}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : atCap ? (
                      t("invite.dialog.teamFull")
                    ) : (
                      t("assignment.dialog.add")
                    )}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("assignment.dialog.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
