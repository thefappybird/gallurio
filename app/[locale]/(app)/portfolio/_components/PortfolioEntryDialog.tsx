"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function Option({
  label,
  hint,
  disabled,
  onClick,
}: {
  label: string;
  hint: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className="flex h-auto w-full flex-col items-start gap-1 p-4 text-start"
    >
      <span className="font-semibold">{label}</span>
      <span className="text-xs font-normal text-muted-foreground">{hint}</span>
    </Button>
  );
}

export function PortfolioEntryDialog({
  open,
  canContinue,
  hasDrafts,
  onContinue,
  onLoadExisting,
  onStartScratch,
}: {
  open: boolean;
  canContinue: boolean;
  hasDrafts: boolean;
  onContinue: () => void;
  onLoadExisting: () => void;
  onStartScratch: () => void;
}) {
  const t = useTranslations("app.pageBuilder.editor");
  // The entry chooser must remain open until the user picks an option — there is no
  // way to dismiss it without making a choice.  Non-dismissal is achieved by two
  // complementary mechanisms that together cover every dismissal path:
  //
  //   1. disablePointerDismissal — prevents the outside-click path from closing the dialog.
  //   2. onOpenChange={() => {}} (no-op) — the Escape key triggers a close request, but
  //      because `open` is fully controlled by the parent and onOpenChange is a no-op,
  //      the request is silently ignored and `open` remains true.
  //
  // showCloseButton={false} removes the × button so there is no third path.
  // onPointerDownOutside / onEscapeKeyDown are Radix-only props — NOT applicable here.
  return (
    <Dialog
      open={open}
      disablePointerDismissal
      onOpenChange={() => {
        // no-op: Escape (and any other close request) is intentionally ignored —
        // the dialog is non-dismissible until the user selects an entry option.
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("entryDialog.title")}</DialogTitle>
          <DialogDescription>{t("entryDialog.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Option
            label={t("entryDialog.resumeTitle")}
            hint={t("entryDialog.resumeHint")}
            disabled={!canContinue}
            onClick={onContinue}
          />
          <Option
            label={t("entryDialog.loadDraftTitle")}
            hint={t("entryDialog.loadDraftHint")}
            disabled={!hasDrafts}
            onClick={onLoadExisting}
          />
          <Option
            label={t("entryDialog.scratchTitle")}
            hint={t("entryDialog.scratchHint")}
            onClick={onStartScratch}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
