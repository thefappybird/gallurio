"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { UserMinusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { RemoveMemberDialog, type RemoveMemberTarget } from "./remove-member-dialog";
import type { MemberSummary, TeamRow } from "../_types";

type Props = {
  members: MemberSummary[];
  teams: TeamRow[];
  ownerWorkosUserId: string;
  workspaceId: string;
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function displayName(m: MemberSummary): string {
  return m.name || m.email;
}

export function ViewMembersSidebar({
  members,
  teams,
  ownerWorkosUserId,
  workspaceId,
  canManage,
  open,
  onOpenChange,
}: Props) {
  const t = useTranslations("app.teams");
  const [removeTarget, setRemoveTarget] = useState<RemoveMemberTarget | null>(null);

  function teamById(teamId: string): TeamRow | undefined {
    return teams.find((tm) => tm.id === teamId);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{t("members.heading")}</SheetTitle>
          <SheetDescription>{t("members.description")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 p-4">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("members.empty")}</p>
          ) : (
            <ul className="flex flex-col border border-border bg-card">
              {members.map((m) => (
                <li
                  key={m.workosUserId}
                  className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm font-medium">{displayName(m)}</span>
                    <span className="truncate text-xs text-muted-foreground">{m.email}</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {m.teams.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {t("members.noTeams")}
                        </span>
                      ) : (
                        m.teams.map((tm) => {
                          const team = teamById(tm.teamId);
                          if (!team) return null;
                          return (
                            <span key={tm.teamId} className="inline-flex items-center gap-1">
                              <Badge variant="outline" className="gap-1 text-xs">
                                <span
                                  aria-hidden="true"
                                  className="size-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: team.color }}
                                />
                                {team.name}
                              </Badge>
                              {tm.role === "lead" && (
                                <Badge variant="secondary" className="text-xs">
                                  {t("members.leadBadge")}
                                </Badge>
                              )}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                  {canManage && m.workosUserId !== ownerWorkosUserId && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      aria-label={t("members.removeFromWorkspaceLabel", { name: displayName(m) })}
                      onClick={() =>
                        setRemoveTarget({
                          workosUserId: m.workosUserId,
                          name: m.name,
                          email: m.email,
                        })
                      }
                    >
                      <UserMinusIcon className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>

      <RemoveMemberDialog
        mode="workspace"
        member={removeTarget}
        workspaceId={workspaceId}
        open={Boolean(removeTarget)}
        onOpenChange={(next) => !next && setRemoveTarget(null)}
      />
    </Sheet>
  );
}
