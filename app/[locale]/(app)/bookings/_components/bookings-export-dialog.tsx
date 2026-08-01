"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DownloadIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { BookingTeamOption } from "../_data/team-options";

type Props = {
  open: boolean;
  onClose: () => void;
  /**
   * Query string carrying the list's own filters (status, search, the two
   * toggles). The dialog appends its own choices to it so a download matches
   * what the table is showing.
   */
  baseParams: string;
  /** Teams the caller can read. Every visible team is exportable. */
  teams?: BookingTeamOption[];
};

const ALL_TEAMS = "";

const FIELD_CLASS =
  "min-h-11 border border-border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:min-h-0";

export function BookingsExportDialog({ open, onClose, baseParams, teams = [] }: Props) {
  const t = useTranslations("app.bookings.exportDialog");
  const [teamId, setTeamId] = useState(ALL_TEAMS);
  const [ranged, setRanged] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");

  // A range needs both ends, and an inverted one would silently export
  // nothing — better a disabled button than an empty file.
  const rangeInvalid = ranged && (!from || !to || from > to);

  const p = new URLSearchParams(baseParams);
  if (format === "xlsx") p.set("format", "xlsx");
  if (teamId) p.set("teamId", teamId);
  if (ranged && from && to) {
    p.set("from", from);
    p.set("to", to);
  } else {
    // All time wins over whatever range the list happened to carry.
    p.delete("from");
    p.delete("to");
  }
  const qs = p.toString();
  const href = `/api/bookings/export${qs ? `?${qs}` : ""}`;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 sm:max-w-md">
        <DialogTitle>{t("title")}</DialogTitle>

        <div className="flex flex-col gap-1">
          <label htmlFor="export-team" className="text-xs font-medium text-foreground">
            {t("teamLabel")}
          </label>
          <select
            id="export-team"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className={FIELD_CLASS}
          >
            <option value={ALL_TEAMS}>{t("allTeams")}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-medium text-foreground">
            {t("rangeLabel")}
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="export-range"
              checked={!ranged}
              onChange={() => setRanged(false)}
              className="size-4 accent-brand"
            />
            {t("allTime")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="export-range"
              checked={ranged}
              onChange={() => setRanged(true)}
              className="size-4 accent-brand"
            />
            {t("dateRange")}
          </label>

          {ranged ? (
            // Native date inputs: keyboard support, locale formatting and the
            // mobile date wheel all come free.
            <div className="ms-6 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="export-from" className="text-xs text-muted-foreground">
                  {t("from")}
                </label>
                <input
                  id="export-from"
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                  className={FIELD_CLASS}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="export-to" className="text-xs text-muted-foreground">
                  {t("to")}
                </label>
                <input
                  id="export-to"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  className={FIELD_CLASS}
                />
              </div>
            </div>
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-medium text-foreground">
            {t("formatLabel")}
          </legend>
          <div className="flex gap-4">
            {(["csv", "xlsx"] as const).map((f) => (
              <label key={f} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="export-format"
                  checked={format === f}
                  onChange={() => setFormat(f)}
                  className="size-4 accent-brand"
                />
                {t(f)}
              </label>
            ))}
          </div>
        </fieldset>

        {["status", "q", "includeCancelled", "showPast"].some((k) => p.has(k)) ? (
          <p className="text-xs text-muted-foreground">{t("listFiltersApply")}</p>
        ) : null}

        {rangeInvalid ? (
          <Button type="button" size="sm" disabled className="min-h-11 sm:min-h-0">
            <DownloadIcon className="size-4" />
            {t("download")}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            nativeButton={false}
            className="min-h-11 sm:min-h-0"
            render={<a href={href} download onClick={onClose} />}
          >
            <DownloadIcon className="size-4" />
            {t("download")}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
