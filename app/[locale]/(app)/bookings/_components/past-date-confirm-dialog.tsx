"use client";

import { useTranslations } from "next-intl";
import { AlertTriangleIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function PastDateConfirmDialog({ open, onCancel, onConfirm }: Props) {
  const t = useTranslations("app.bookings.calendar.pastDateConfirm");

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
