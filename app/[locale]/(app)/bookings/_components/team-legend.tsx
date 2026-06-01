"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { INACTIVE_TEAM_COLOR } from "@/lib/teams/team-colors";
import type { BookingTeamOption } from "../_data/team-options";

type Props = {
  teams: BookingTeamOption[];
  /** Selected team ids. EMPTY = all teams (no filter). */
  selected: string[];
  isOwner: boolean;
  /** Receives the next selection array (empty = all). */
  onChange: (next: string[]) => void;
};

/**
 * Team legend that doubles as a MULTI-select team filter — the calendar
 * counterpart of the table view's team dropdown. Each chip's swatch matches the
 * team-colored candle. Clicking a team chip toggles it in/out of the selection;
 * clicking "All teams" clears the selection (= show all). Multiple teams can be
 * active at once. Deactivated teams remain selectable (view-only) and show the
 * neutral archival swatch + strikethrough name.
 */
export function TeamLegend({ teams, selected, isOwner, onChange }: Props) {
  const t = useTranslations("app.bookings.teamPicker");
  const activeTeams = teams.filter((team) => team.isActive);
  const inactiveTeams = teams.filter((team) => !team.isActive);
  const allActive = selected.length === 0;

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  function chipClass(isActive: boolean) {
    return cn(
      "inline-flex min-h-8 items-center gap-1.5 border px-2 py-1 text-xs font-medium transition-colors",
      "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      isActive ? "border-foreground text-foreground" : "border-border text-muted-foreground",
      !allActive && !isActive && "opacity-60",
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
        onClick={() => onChange([])}
        aria-pressed={allActive}
        className={chipClass(allActive)}
      >
        {isOwner ? t("allTeams") : t("allMyTeams")}
      </button>

      {activeTeams.map((team) => {
        const isActive = selected.includes(team.id);
        return (
          <button
            key={team.id}
            type="button"
            onClick={() => toggle(team.id)}
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
        const isActive = selected.includes(team.id);
        return (
          <button
            key={team.id}
            type="button"
            onClick={() => toggle(team.id)}
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
