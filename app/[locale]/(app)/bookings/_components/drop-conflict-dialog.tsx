"use client";

import { useTranslations } from "next-intl";
import { AlertTriangleIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ShiftHit = {
  id: string;
  title: string;
  shiftStart: string;
  shiftEnd: string;
};

type Props = {
  open: boolean;
  conflicts: ShiftHit[];
  proposedStart: Date;
  proposedEnd: Date;
  onCancel: () => void;
  onConfirm: () => void;
};

function formatHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function DropConflictDialog({
  open,
  conflicts,
  proposedStart,
  onCancel,
  onConfirm,
}: Props) {
  const t = useTranslations("app.bookings.calendar.dropConflict");

  const dateLabel = proposedStart.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="flex max-w-md flex-col gap-0 p-0">
        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground">
            <AlertTriangleIcon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle>{t("title", { date: dateLabel })}</DialogTitle>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
        </div>

        <ul className="border-b border-border px-4 py-3 flex flex-col gap-1.5">
          {conflicts.map((c) => (
            <li key={c.id} className="text-sm text-foreground">
              <span className="font-medium">{c.title}</span>
              <span className="text-muted-foreground">
                {" · "}
                {formatHHMM(c.shiftStart)}–{formatHHMM(c.shiftEnd)}
              </span>
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
            {t("moveAnyway")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
