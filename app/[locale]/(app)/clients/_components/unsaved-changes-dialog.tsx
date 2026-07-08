"use client";

import { useTranslations } from "next-intl";
import { AlertCircleIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
};

export function UnsavedChangesDialog({ open, onKeepEditing, onDiscard }: Props) {
  const t = useTranslations("app.clients.unsaved");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onKeepEditing()}>
      <DialogContent showCloseButton={false} className="flex max-h-[calc(100dvh-2rem)] sm:max-w-md flex-col gap-0 p-0">
        <div className="flex items-start gap-3 overflow-y-auto border-b border-border px-4 py-3">
          <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center border border-border bg-muted text-muted-foreground">
            <AlertCircleIcon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle>{t("title")}</DialogTitle>
            <p className="text-sm text-muted-foreground">{t("body")}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 px-4 py-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onKeepEditing}
            className="min-h-11 sm:min-h-0"
          >
            {t("keep")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onDiscard}
            className="min-h-11 sm:min-h-0"
          >
            {t("discard")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
