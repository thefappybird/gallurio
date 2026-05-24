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
import type { WizardValues } from "./booking-wizard-steps/types";

type Props = {
  open: boolean;
  conflicts: ShiftHit[][];
  sessions: WizardValues["sessions"];
  onCancel: () => void;
  onProceed: () => void;
};

function formatSessionDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function ConflictAckDialog({
  open,
  conflicts,
  sessions,
  onCancel,
  onProceed,
}: Props) {
  const t = useTranslations("app.bookings.wizard.conflictDialog");

  const sessionConflicts = conflicts
    .map((hits, i) => ({ hits, session: sessions[i] }))
    .filter(({ hits }) => hits.length > 0);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-w-md flex-col gap-0 p-0"
      >
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center border border-destructive bg-destructive/10 text-destructive">
            <AlertTriangleIcon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle>{t("title")}</DialogTitle>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-4 py-3">
          {sessionConflicts.map(({ hits, session }, idx) => (
            <div key={idx} className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-foreground">
                {formatSessionDate(session?.startDate ?? "")}
              </p>
              <ul className="flex flex-col gap-0.5">
                {hits.map((c) => (
                  <li key={c.id} className="text-xs text-muted-foreground">
                    <span className="tabular-nums text-foreground">
                      {c.shiftStart}–{c.shiftEnd}
                    </span>{" "}
                    · {c.title}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col-reverse gap-2 px-4 py-3 sm:flex-row sm:justify-end border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onProceed}
          >
            {t("proceed")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
