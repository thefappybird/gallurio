"use client";

import { useTranslations } from "next-intl";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TeamLegend } from "./team-legend";
import type { BookingTeamOption } from "../_data/team-options";

/**
 * Table-view team filter: a dropdown (popover) whose panel is the multi-select
 * team legend. Trigger shows the active selection summary. Empty selection means
 * "all teams". The calendar view renders <TeamLegend> inline instead.
 */
export function TeamPicker({
  teams,
  selected,
  isOwner,
  onChange,
}: {
  teams: BookingTeamOption[];
  selected: string[];
  isOwner: boolean;
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations("app.bookings.teamPicker");

  const label =
    selected.length === 0
      ? isOwner
        ? t("allTeams")
        : t("allMyTeams")
      : selected.length === 1
        ? (teams.find((team) => team.id === selected[0])?.name ?? t("countLabel", { count: 1 }))
        : t("countLabel", { count: selected.length });

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="w-full justify-between font-normal sm:w-48"
            aria-label={t("label")}
          >
            <span className="truncate">{label}</span>
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-64">
        <TeamLegend teams={teams} selected={selected} isOwner={isOwner} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}
