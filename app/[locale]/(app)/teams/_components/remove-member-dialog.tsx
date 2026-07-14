"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  removeMemberFromTeamAction,
  removeMemberFromWorkspaceAction,
} from "../_member-action";
import {
  isWorkspaceRemovalPromptDismissed,
  dismissWorkspaceRemovalPrompt,
} from "@/lib/teams/workspace-removal-prompt";

export type RemoveMemberTarget = {
  workosUserId: string;
  name: string;
  email: string;
};

type Props = {
  mode: "team" | "workspace";
  member: RemoveMemberTarget | null;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId?: string;
  teamName?: string;
};

function displayName(m: RemoveMemberTarget): string {
  return m.name || m.email;
}

export function RemoveMemberDialog({
  mode,
  member,
  workspaceId,
  open,
  onOpenChange,
  teamId,
  teamName,
}: Props) {
  const t = useTranslations("app.teams");
  const [step, setStep] = useState<
    "team-confirm" | "workspace-prompt" | "workspace-confirm" | "blocked"
  >(mode === "team" ? "team-confirm" : "workspace-confirm");
  const [blockedTeamName, setBlockedTeamName] = useState("");
  const [dontAskAgain, setDontAskAgain] = useState(false);

  async function handleTeamConfirm() {
    if (!member || !teamId) return;
    await removeMemberFromTeamAction({ workosUserId: member.workosUserId, teamId });
    if (isWorkspaceRemovalPromptDismissed(workspaceId)) {
      onOpenChange(false);
      return;
    }
    setStep("workspace-prompt");
  }

  if (!member) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="hidden" />
      </Dialog>
    );
  }

  const name = displayName(member);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {mode === "team" && step === "team-confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t("drawer.removeMemberFlow.confirmTitle", { name, team: teamName ?? "" })}
              </DialogTitle>
              <DialogDescription>
                {t("drawer.removeMemberFlow.confirmDescription")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("createDialog.cancel")}
              </Button>
              <Button variant="destructive" onClick={handleTeamConfirm}>
                {t("drawer.removeMemberFlow.confirmButton")}
              </Button>
            </DialogFooter>
          </>
        )}

        {mode === "team" && step === "workspace-prompt" && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t("drawer.removeMemberFlow.workspacePromptTitle", { name })}
              </DialogTitle>
              <DialogDescription>
                {t("drawer.removeMemberFlow.workspacePromptDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <input
                id="dont-ask-again-workspace-removal"
                type="checkbox"
                checked={dontAskAgain}
                onChange={(e) => setDontAskAgain(e.target.checked)}
                className="size-4 cursor-pointer accent-foreground"
              />
              <Label
                htmlFor="dont-ask-again-workspace-removal"
                className="cursor-pointer text-sm font-normal text-muted-foreground"
              >
                {t("drawer.removeMemberFlow.dontAskAgain")}
              </Label>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  if (dontAskAgain) dismissWorkspaceRemovalPrompt(workspaceId);
                  onOpenChange(false);
                }}
              >
                {t("drawer.removeMemberFlow.keepInWorkspaceButton")}
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!member) return;
                  if (dontAskAgain) dismissWorkspaceRemovalPrompt(workspaceId);
                  const result = await removeMemberFromWorkspaceAction({
                    workosUserId: member.workosUserId,
                  });
                  if (result.error) {
                    setBlockedTeamName(result.teamName ?? "");
                    setStep("blocked");
                    return;
                  }
                  onOpenChange(false);
                }}
              >
                {t("drawer.removeMemberFlow.removeFromWorkspaceButton")}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "workspace-confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>{t("members.removeDialog.title")}</DialogTitle>
              <DialogDescription>
                {t("members.removeDialog.description", { name })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("createDialog.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!member) return;
                  const result = await removeMemberFromWorkspaceAction({
                    workosUserId: member.workosUserId,
                  });
                  if (result.error) {
                    setBlockedTeamName(result.teamName ?? "");
                    setStep("blocked");
                    return;
                  }
                  onOpenChange(false);
                }}
              >
                {t("members.removeDialog.confirm")}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "blocked" && (
          <DialogHeader>
            <DialogTitle>{t("members.removeDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("members.errors.isTeamLead", { name, teamName: blockedTeamName })}
            </DialogDescription>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  );
}
