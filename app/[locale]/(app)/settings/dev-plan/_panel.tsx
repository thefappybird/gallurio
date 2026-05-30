"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { devActivatePlanAction, type DevPlanActionResult } from "@/lib/actions/dev";
import { PLAN_CATALOG } from "@/lib/hitpay/plans";
import type { PlanTier } from "@/lib/db/models";
import { DowngradeBlockModal } from "../../teams/_components/downgrade-block-modal";

type DevPlanPanelProps = {
  currentPlan: PlanTier;
};

export function DevPlanPanel({ currentPlan }: DevPlanPanelProps) {
  const t = useTranslations("app.settings.devPlan");
  const [pending, startTransition] = useTransition();
  const [busyTier, setBusyTier] = useState<PlanTier | null>(null);
  const [blocked, setBlocked] = useState<DevPlanActionResult["blocked"] | null>(null);
  const [blockedTarget, setBlockedTarget] = useState<PlanTier | null>(null);

  function switchTo(plan: PlanTier) {
    if (plan === currentPlan) return;
    setBusyTier(plan);
    startTransition(async () => {
      const result = await devActivatePlanAction(plan);
      setBusyTier(null);
      if (result.error === "TEAM_DOWNGRADE_BLOCKED" && result.blocked) {
        setBlockedTarget(plan);
        setBlocked(result.blocked);
        return;
      }
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("toasts.switched", { plan }));
      // Re-render the page so settings reflect the new plan.
      window.location.reload();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3 border border-border bg-card p-4">
        <Wrench className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">{t("title")}</p>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("currentLabel")}: <span className="font-medium text-foreground">{currentPlan}</span>
        </p>
        <ul className="flex flex-col border border-border">
          {PLAN_CATALOG.map((entry) => {
            const isCurrent = entry.id === currentPlan;
            const busy = busyTier === entry.id;
            return (
              <li
                key={entry.id}
                className="flex items-center gap-3 border-b border-border bg-background px-3 py-3 last:border-0"
              >
                <div className="flex flex-1 flex-col">
                  <span className="font-medium capitalize">{entry.id}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.entitlements.maxTeams} {t("teamsSuffix")} ·{" "}
                    {entry.entitlements.maxMembersPerTeam} {t("perTeamSuffix")}
                  </span>
                </div>
                {isCurrent ? (
                  <span className="text-xs text-muted-foreground">{t("active")}</span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => switchTo(entry.id)}
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : t("switch")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {blocked && blockedTarget && (
        <DowngradeBlockModal
          open={Boolean(blocked)}
          onOpenChange={(next) => {
            if (!next) {
              setBlocked(null);
              setBlockedTarget(null);
            }
          }}
          currentPlan={currentPlan === "free" ? "starter" : (currentPlan as "starter" | "pro")}
          targetPlan={blockedTarget === "pro" ? "starter" : blockedTarget === "starter" ? "free" : "free"}
          currentTeamCount={blocked.currentTeamCount}
          maxTeamsOnTargetPlan={blocked.maxTeamsOnTargetPlan}
          teamsToReview={blocked.teams}
        />
      )}
    </div>
  );
}
