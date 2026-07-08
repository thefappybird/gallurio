"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DraftSummary } from "../_draftActions";

export function DraftsDialog({
  open,
  onOpenChange,
  drafts,
  activeDraftId,
  onApply,
  onDelete,
  onAddNew,
  deletingId = null,
  unsavedDraftName = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: DraftSummary[];
  activeDraftId: string | null;
  onApply: (id: string) => void;
  onDelete: (id: string) => void;
  onAddNew: () => void;
  /** Id of the draft currently being deleted; disables all interactive elements. */
  deletingId?: string | null;
  /** When non-null, an unsaved draft with this name is shown at the top of the list. */
  unsavedDraftName?: string | null;
}) {
  const t = useTranslations("app.pageBuilder.editor");
  const [pendingDelete, setPendingDelete] = useState<DraftSummary | null>(null);

  // Clear pending delete when the dialog closes so it can't linger.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setPendingDelete(null);
  }

  const isDeleting = deletingId !== null;
  const hasUnsaved = unsavedDraftName !== null;
  // When a delete is in progress, block the dialog from closing.
  const handleOpenChange = (next: boolean) => {
    if (isDeleting) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("draftsDialog.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <p className="text-sm text-muted-foreground">{t("draftsDialog.subtitle")}</p>

          {drafts.length === 0 && !hasUnsaved ? (
            <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {t("draftsDialog.empty")}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Unsaved draft entry — shown at the top when the active draft has no DB record yet */}
              {hasUnsaved && (
                <li className="border-2 border-dashed border-muted-foreground/40 p-3">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2 truncate">
                      <span className="min-w-0 flex-1 truncate font-semibold" title={unsavedDraftName!}>
                        {unsavedDraftName}
                      </span>
                      <span className="shrink-0 border border-border px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                        {t("draftsDialog.unsaved")}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-1">
                      <span className="border border-foreground px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                        {t("draftsDialog.active")}
                      </span>
                    </div>
                  </div>
                </li>
              )}
              {drafts.map((d) => {
                const isActive = d.id === activeDraftId;
                const isBeingDeleted = d.id === deletingId;
                const isLastActiveDraft = isActive && drafts.length === 1 && !hasUnsaved;
                return (
                  <li
                    key={d.id}
                    className={cn(
                      "border p-3",
                      isActive ? "border-foreground" : "border-border"
                    )}
                  >
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate font-semibold" title={d.name}>
                        {d.name}
                      </span>
                      <div className="flex w-[7.5rem] shrink-0 items-center justify-end gap-1">
                        {isActive && (
                          <span className="border border-border px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                            {t("draftsDialog.active")}
                          </span>
                        )}
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          aria-label={t("draftsDialog.applyAria", { name: d.name })}
                          title={t("draftsDialog.applyAria", { name: d.name })}
                          disabled={isDeleting}
                          onClick={() => onApply(d.id)}
                        >
                          <Check />
                        </Button>
                        {isBeingDeleted ? (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={t("draftsDialog.deletingAria", { name: d.name })}
                            disabled
                          >
                            <Loader2 className="animate-spin" />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={t("draftsDialog.deleteAria", { name: d.name })}
                            title={t("draftsDialog.deleteAria", { name: d.name })}
                            disabled={isDeleting || isLastActiveDraft}
                            onClick={() => setPendingDelete(d)}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" disabled={isDeleting} onClick={() => onOpenChange(false)}>
            {t("draftsDialog.close")}
          </Button>
          <Button type="button" disabled={isDeleting} onClick={onAddNew}>
            {t("draftsDialog.addNew")}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("draftsDialog.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("draftsDialog.confirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(null)}>
              {t("draftsDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              {t("draftsDialog.confirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
