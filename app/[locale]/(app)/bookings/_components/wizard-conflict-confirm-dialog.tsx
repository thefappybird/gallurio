"use client";

import { useTranslations } from "next-intl";
import { AlertTriangleIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ShiftHit } from "./booking-wizard-steps/event-step";

type SessionSummary = {
  startDate: string;
  startTime: string;
  endTime: string;
};

type Props = {
  open: boolean;
  /** Per-session conflicts — parallel to sessions[]. Only sessions with a
   *  non-empty inner array are displayed. */
  conflicts: ShiftHit[][];
  sessions: SessionSummary[];
  onCancel: () => void;
  onConfirm: () => void;
};

function formatSessionDate(iso: string): string {
  if (!iso) return iso;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function WizardConflictConfirmDialog({
  open,
  conflicts,
  sessions,
  onCancel,
  onConfirm,
}: Props) {
  const t = useTranslations("app.bookings.wizard.conflictConfirm");

  const conflictingSessions = sessions
    .map((s, i) => ({ session: s, hits: conflicts[i] ?? [] }))
    .filter(({ hits }) => hits.length > 0);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="flex max-w-md flex-col gap-0 p-0">
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground">
            <AlertTriangleIcon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle>{t("title")}</DialogTitle>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
        </div>

        <ul className="border-b border-border px-4 py-3 flex flex-col gap-3">
          {conflictingSessions.map(({ session, hits }) => (
            <li key={session.startDate} className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-foreground">
                {formatSessionDate(session.startDate)}
              </span>
              <ul className="flex flex-col gap-0.5">
                {hits.map((c) => (
                  <li key={c.id} className="text-sm text-foreground">
                    <span className="font-medium">{c.title}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {c.shiftStart}–{c.shiftEnd}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 flex-1"
            onClick={onCancel}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="min-h-11 flex-1"
            onClick={onConfirm}
          >
            {t("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
