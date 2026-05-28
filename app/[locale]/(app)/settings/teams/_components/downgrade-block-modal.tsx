"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export type DowngradeBlockModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: "starter" | "pro";
  targetPlan: "free" | "starter";
  currentTeamCount: number;
  maxTeamsOnTargetPlan: number;
  teamsToReview: { id: string; name: string; color: string; isDefault: boolean }[];
};

export function DowngradeBlockModal({
  open,
  onOpenChange,
  currentPlan,
  targetPlan,
  currentTeamCount,
  maxTeamsOnTargetPlan,
  teamsToReview,
}: DowngradeBlockModalProps) {
  const t = useTranslations("app.settings.teams");
  const excess = Math.max(0, currentTeamCount - maxTeamsOnTargetPlan);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            {t("downgradeBlock.title")}
          </DialogTitle>
          <DialogDescription>
            {t("downgradeBlock.description", {
              currentPlan,
              targetPlan,
              maxTeams: maxTeamsOnTargetPlan,
              excess,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="border border-border bg-card">
          <p className="border-b border-border bg-muted px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
            {t("downgradeBlock.teamsHeading")}
          </p>
          <ul className="flex flex-col">
            {teamsToReview.map((team) => (
              <li
                key={team.id}
                className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0"
              >
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: team.color, width: 14, height: 14 }}
                  className="shrink-0"
                />
                <span className="flex-1 text-sm">{team.name}</span>
                {team.isDefault && (
                  <span className="text-xs text-muted-foreground">
                    {t("team.defaultBadge")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("downgradeBlock.dismiss")}
          </Button>
          <a
            href="#teams-list"
            className={buttonVariants({ variant: "default" })}
            onClick={() => onOpenChange(false)}
          >
            {t("downgradeBlock.manageTeams")}
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
