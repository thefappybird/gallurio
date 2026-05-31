"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BookingTeamOption } from "../_data/team-options";

const ALL = "all";

export function TeamPicker({
  teams,
  value,
  isOwner,
  onChange,
}: {
  teams: BookingTeamOption[];
  value: string;
  isOwner: boolean;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("app.bookings.teamPicker");

  const activeTeams = teams.filter((team) => team.isActive);
  const inactiveTeams = teams.filter((team) => !team.isActive);

  const selectedTeam = value !== ALL ? teams.find((team) => team.id === value) : null;

  return (
    <Select<string> value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger
        className="w-full sm:w-48"
        aria-label={t("label")}
      >
        <SelectValue>
          {() =>
            selectedTeam ? (
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 shrink-0"
                  style={{ backgroundColor: selectedTeam.color }}
                />
                <span>{selectedTeam.name}</span>
              </span>
            ) : (
              <span>{isOwner ? t("allTeams") : t("allMyTeams")}</span>
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>
          {isOwner ? t("allTeams") : t("allMyTeams")}
        </SelectItem>

        {activeTeams.map((team) => (
          <SelectItem key={team.id} value={team.id}>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 shrink-0"
                style={{ backgroundColor: team.color }}
              />
              <span>{team.name}</span>
            </span>
          </SelectItem>
        ))}

        {inactiveTeams.map((team) => (
          <SelectItem key={team.id} value={team.id}>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 shrink-0"
                style={{ backgroundColor: team.color }}
              />
              <span>{team.name}</span>
              <span className="text-muted-foreground">{t("inactive")}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
