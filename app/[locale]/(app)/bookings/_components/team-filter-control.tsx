"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { BookingTeamOption } from "../_data/team-options";

const INACTIVE_COLOR = "var(--muted-foreground)";
const PAGE_SIZE = 12; // 4 cols × 3 rows
const INLINE_THRESHOLD = 4;

type Props = {
  teams: BookingTeamOption[];
  selected: string[];
  isOwner: boolean;
  onChange: (next: string[]) => void;
};

function chipClass(active: boolean, allActive: boolean) {
  return cn(
    "inline-flex min-h-9 items-center gap-1.5 border px-2 py-1 text-xs font-medium transition-colors",
    "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    active ? "border-foreground text-foreground" : "border-border text-muted-foreground",
    !allActive && !active && "opacity-60",
  );
}

export function TeamFilterControl({ teams, selected, isOwner, onChange }: Props) {
  const t = useTranslations("app.bookings.teamPicker");
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);

  const allActive = selected.length === 0;
  const canInline = teams.length <= INLINE_THRESHOLD;
  const activeTeams = teams.filter((tm) => tm.isActive);
  const inactiveTeams = teams.filter((tm) => !tm.isActive);
  const allTeams = [...activeTeams, ...inactiveTeams];
  const pageCount = Math.ceil(allTeams.length / PAGE_SIZE);
  const pageTeams = allTeams.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  const inlineChips = (
    <div role="group" aria-label={t("label")} className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <button
        type="button"
        onClick={() => onChange([])}
        aria-pressed={allActive}
        className={chipClass(allActive, true)}
      >
        {isOwner ? t("allTeams") : t("allMyTeams")}
      </button>
      {activeTeams.map((team) => {
        const active = selected.includes(team.id);
        return (
          <button
            key={team.id}
            type="button"
            onClick={() => toggle(team.id)}
            aria-pressed={active}
            className={chipClass(active, allActive)}
          >
            <span aria-hidden className="size-2.5 shrink-0" style={{ backgroundColor: team.color }} />
            {team.name}
          </button>
        );
      })}
      {inactiveTeams.map((team) => {
        const active = selected.includes(team.id);
        return (
          <button
            key={team.id}
            type="button"
            onClick={() => toggle(team.id)}
            aria-pressed={active}
            title={t("inactive")}
            className={chipClass(active, allActive)}
          >
            <span aria-hidden className="size-2.5 shrink-0" style={{ backgroundColor: INACTIVE_COLOR }} />
            <span className="line-through">{team.name}</span>
          </button>
        );
      })}
    </div>
  );

  const popoverButton = (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setPage(0);
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 border px-2.5 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              selected.length > 0
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:bg-accent/40",
            )}
          />
        }
      >
        <UsersIcon className="size-3.5 shrink-0" />
        <span>{t("teams")}</span>
        {selected.length > 0 && (
          <span className="tabular-nums text-[10px] text-background/70">{selected.length}</span>
        )}
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-72 p-3">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onChange([])}
            aria-pressed={allActive}
            className={cn(
              "w-full border px-2 py-1.5 text-left text-xs font-medium transition-colors",
              "hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              allActive ? "border-foreground text-foreground" : "border-border text-muted-foreground",
            )}
          >
            {isOwner ? t("allTeams") : t("allMyTeams")}
          </button>

          <div className="grid grid-cols-4 gap-1.5">
            {pageTeams.map((team) => {
              const active = selected.includes(team.id);
              const inactive = !team.isActive;
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => toggle(team.id)}
                  aria-pressed={active}
                  title={team.name + (inactive ? ` (${t("inactive")})` : "")}
                  className={cn(
                    "flex flex-col items-center gap-1 border p-1.5 text-[10px] leading-tight transition-colors",
                    "hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    active ? "border-foreground" : "border-border",
                    !allActive && !active && "opacity-60",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-5 shrink-0"
                    style={{ backgroundColor: inactive ? INACTIVE_COLOR : team.color }}
                  />
                  <span className={cn("w-full truncate text-center", inactive && "line-through")}>
                    {team.name}
                  </span>
                </button>
              );
            })}
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-2">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
                aria-label="Previous page"
                className="p-1 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ChevronLeftIcon className="size-4" />
              </button>
              <span className="text-xs text-muted-foreground">
                {page + 1} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page === pageCount - 1}
                aria-label="Next page"
                className="p-1 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ChevronRightIcon className="size-4" />
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );

  if (canInline) {
    return (
      <>
        <div className="hidden items-center lg:flex">{inlineChips}</div>
        <div className="flex items-center lg:hidden">{popoverButton}</div>
      </>
    );
  }

  return popoverButton;
}
