"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { INACTIVE_TEAM_COLOR } from "@/lib/teams/team-colors";
import type { BookingTeamOption } from "../_data/team-options";

const ALL = "all";

type Props = {
  teams: BookingTeamOption[];
  /** Active selection: "all" or a team id. */
  value: string;
  isOwner: boolean;
  /** Select "all" or a team id. Selecting the active team again clears to "all". */
  onSelect: (value: string) => void;
};

/**
 * Calendar team legend that doubles as a single-select team filter — the
 * calendar counterpart of the toolbar team dropdown (which is used in table
 * view). Each chip's swatch matches the team-colored candle; clicking filters
 * to that team, clicking the active chip again clears back to "all". Deactivated
 * teams remain selectable (view-only) and render with an "inactive" hint +
 * the neutral archival swatch is shown once via the trailing chip.
 */
export function TeamLegend({ teams, value, isOwner, onSelect }: Props) {
  const t = useTranslations("app.bookings.teamPicker");
  const activeTeams = teams.filter((team) => team.isActive);
  const inactiveTeams = teams.filter((team) => !team.isActive);

  function chipClass(isActive: boolean) {
    return cn(
      "inline-flex min-h-8 items-center gap-1.5 border px-2 py-1 text-xs font-medium transition-colors",
      "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      isActive ? "border-foreground text-foreground" : "border-border text-muted-foreground",
      value !== ALL && !isActive && "opacity-60",
    );
  }

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5"
    >
      <button
        type="button"
        onClick={() => onSelect(ALL)}
        aria-pressed={value === ALL}
        className={chipClass(value === ALL)}
      >
        {isOwner ? t("allTeams") : t("allMyTeams")}
      </button>

      {activeTeams.map((team) => {
        const isActive = value === team.id;
        return (
          <button
            key={team.id}
            type="button"
            onClick={() => onSelect(isActive ? ALL : team.id)}
            aria-pressed={isActive}
            className={chipClass(isActive)}
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0"
              style={{ backgroundColor: team.color }}
            />
            {team.name}
          </button>
        );
      })}

      {inactiveTeams.map((team) => {
        const isActive = value === team.id;
        return (
          <button
            key={team.id}
            type="button"
            onClick={() => onSelect(isActive ? ALL : team.id)}
            aria-pressed={isActive}
            className={chipClass(isActive)}
            title={t("inactive")}
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0"
              style={{ backgroundColor: INACTIVE_TEAM_COLOR }}
            />
            <span className="line-through">{team.name}</span>
          </button>
        );
      })}
    </div>
  );
}
